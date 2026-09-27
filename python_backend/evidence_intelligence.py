"""Structured CDR and financial evidence intelligence for CIPHER Vision.

This module is deliberately source-driven: it parses records from evidence files
already stored for a case and never invents missing values.  CDR and financial
records keep a direct evidence/document reference and can be highlighted against
a canonical CIPHER entity without hiding unrelated records.
"""
from __future__ import annotations
import csv, io, json, re, hashlib, os
from pathlib import Path
from typing import Any

PHONE_RE = re.compile(r"(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)")
ACCOUNT_KEYS = {"account","accountnumber","accountno","bankaccount","sourceaccount","destinationaccount","fromaccount","toaccount","senderaccount","receiveraccount","beneficiaryaccount","acct","acctno"}
UPI_KEYS = {"upi","upiid","vpa","virtualpaymentaddress"}

def norm(v: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(v or "").strip().lower())

def clean(v: Any) -> str:
    return str(v or "").strip()

def canonical_headers(headers):
    return [clean(h).lstrip("\ufeff") for h in headers]

def classify_headers(headers, filename=""):
    hs={norm(h) for h in headers}; fn=norm(filename)
    cdr_alias={"caller","callingnumber","anumber","originatingnumber","fromnumber","sourcephone","sourcephonenumber","msisdna"}
    callee_alias={"callee","callednumber","bnumber","terminatingnumber","tonumber","destinationphone","destinationphonenumber","msisdnb"}
    time_alias={"timestamp","starttime","calltime","datetime","date","eventtime","callstart","startdatetime"}
    duration_alias={"duration","durationseconds","callduration","seconds","durationsec"}
    financial_alias={"transactionid","txnid","amount","transactionamount","debit","credit","balance","senderaccount","receiveraccount","sourceaccount","destinationaccount","fromaccount","toaccount","upiid","ifsc","narration","transactiontype"}
    if (hs & cdr_alias and (hs & callee_alias or hs & time_alias or hs & duration_alias)) or any(x in fn for x in ("cdr","calldetail","callrecord","telecom","msisdn")):
        return "CDR"
    if len(hs & financial_alias) >= 2 or any(x in fn for x in ("bank","statement","transaction","financial","ledger","neft","rtgs","upi","wallet")):
        return "FINANCIAL"
    return "OTHER"

def first_value(row, aliases):
    by={norm(k):v for k,v in row.items()}
    for a in aliases:
        if norm(a) in by and clean(by[norm(a)]): return clean(by[norm(a)])
    return ""

def parse_amount(v):
    s=clean(v).replace(",","").replace("₹","").replace("$","").replace("€","").replace("£","")
    m=re.search(r"-?\d+(?:\.\d+)?",s)
    return float(m.group()) if m else None

def _record_key(kind, row):
    raw=json.dumps(row,sort_keys=True,ensure_ascii=False,default=str)
    return hashlib.sha256((kind+"|"+raw).encode()).hexdigest()

def parse_cdr_rows(rows, source_document_id=None, filename=""):
    out=[]
    for idx,row in enumerate(rows,1):
        caller=first_value(row,["caller","calling_number","A_NUMBER","originating_number","from_number","source_phone","source_phone_number","msisdn_a"])
        callee=first_value(row,["callee","called_number","B_NUMBER","terminating_number","to_number","destination_phone","destination_phone_number","msisdn_b"])
        timestamp=first_value(row,["timestamp","start_time","call_time","datetime","date","event_time","call_start","start_datetime"])
        duration=first_value(row,["duration","duration_seconds","call_duration","seconds","duration_sec"])
        call_type=first_value(row,["call_type","type","direction","service_type"])
        cell=first_value(row,["cell_id","cell_tower_id","tower_id","tower","cell","location_id"])
        imei=first_value(row,["imei"]); imsi=first_value(row,["imsi"])
        if not (caller or callee): continue
        out.append({"record_key":_record_key("CDR",row),"row_number":idx,"caller":caller,"callee":callee,"timestamp":timestamp,"duration_seconds":parse_amount(duration),"call_type":call_type,"cell_id":cell,"imei":imei,"imsi":imsi,"source_document_id":source_document_id,"source_filename":filename,"raw":row})
    return out

def parse_financial_rows(rows, source_document_id=None, filename=""):
    out=[]
    for idx,row in enumerate(rows,1):
        txid=first_value(row,["transaction_id","txn_id","transactionid","reference","reference_id","utr","rrn","transaction_ref"])
        timestamp=first_value(row,["timestamp","datetime","date","transaction_date","transaction_time","value_date"])
        frm=first_value(row,["from_account","source_account","sender_account","debit_account","account_from","payer_account","senderaccount"])
        to=first_value(row,["to_account","destination_account","receiver_account","credit_account","account_to","beneficiary_account","receiveraccount"])
        sender=first_value(row,["sender","sender_name","from_name","payer","payer_name","debtor"])
        receiver=first_value(row,["receiver","receiver_name","to_name","beneficiary","beneficiary_name","creditor"])
        amount_raw=first_value(row,["amount","transaction_amount","value","total_amount","debit","credit"])
        currency=first_value(row,["currency","ccy"]) or ("INR" if "₹" in amount_raw else "")
        ttype=first_value(row,["transaction_type","type","mode","channel","payment_type"])
        bank=first_value(row,["bank","bank_name","institution"])
        upi=first_value(row,["upi_id","upi","vpa","virtual_payment_address"])
        ifsc=first_value(row,["ifsc","ifsc_code"])
        narration=first_value(row,["narration","description","remarks","memo","purpose"])
        account=first_value(row,["account","account_number","account_no","acct","acct_no"])
        if not any((frm,to,sender,receiver,amount_raw,txid,upi,account,narration)): continue
        out.append({"record_key":_record_key("FINANCIAL",row),"row_number":idx,"transaction_id":txid,"timestamp":timestamp,"from_account":frm or account,"to_account":to,"sender_name":sender,"receiver_name":receiver,"amount":parse_amount(amount_raw),"currency":currency,"transaction_type":ttype,"bank":bank,"upi_id":upi,"ifsc":ifsc,"narration":narration,"source_document_id":source_document_id,"source_filename":filename,"raw":row})
    return out

def read_csv_file(path):
    raw=Path(path).read_bytes()
    text=raw.decode("utf-8-sig",errors="replace")
    reader=csv.DictReader(io.StringIO(text))
    headers=canonical_headers(reader.fieldnames or [])
    rows=[{canonical_headers([k])[0]:v for k,v in r.items()} for r in reader]
    return headers,rows

def extract_case_records(conn, case_id:int, kind:str):
    docs=conn.execute("SELECT * FROM documents WHERE case_id=? ORDER BY uploaded_at DESC",(case_id,)).fetchall()
    records=[]
    for d in docs:
        filename=clean(d["filename"]); ext=Path(filename).suffix.lower(); ftype=clean(d["file_type"]).lower()
        if ext != ".csv":
            # Preserve audio/PDF/image evidence in the document response, but structured
            # rows require a parser. PDF/image OCR is handled when optional OCR is available.
            continue
        path=clean(d["file_path"])
        if path.startswith("supabase://") or not os.path.isfile(path): continue
        try: headers,rows=read_csv_file(path)
        except Exception: continue
        detected=classify_headers(headers,filename)
        if detected != kind: continue
        parsed=parse_cdr_rows(rows,d["id"],filename) if kind=="CDR" else parse_financial_rows(rows,d["id"],filename)
        records.extend(parsed)
    return records

def entity_identifiers(conn, case_id:int, entity_id:int):
    ids=set()
    row=conn.execute("SELECT label,aliases,entity_type,external_id FROM entities WHERE id=? AND case_id=?",(entity_id,case_id)).fetchone()
    if row:
        for v in (row["label"],row["external_id"]):
            if clean(v): ids.add(norm_identifier(v))
        try:
            for a in json.loads(row["aliases"] or "[]") if str(row["aliases"] or "").strip().startswith("[") else re.split(r"[,;|]",str(row["aliases"] or "")):
                if clean(a): ids.add(norm_identifier(a))
        except Exception: pass
    rels=conn.execute("SELECT s.id sid,s.label slabel,s.entity_type stype,t.id tid,t.label tlabel,t.entity_type ttype,r.relationship_type FROM relationships r JOIN entities s ON s.id=r.source_entity_id JOIN entities t ON t.id=r.target_entity_id WHERE r.case_id=? AND (r.source_entity_id=? OR r.target_entity_id=?) AND LOWER(COALESCE(r.verification_status,''))='verified'",(case_id,entity_id,entity_id)).fetchall()
    for r in rels:
        for k in ("slabel","tlabel"):
            if clean(r[k]): ids.add(norm_identifier(r[k]))
    return {x for x in ids if x}

def norm_identifier(v):
    s=clean(v).lower()
    digits=re.sub(r"\D+","",s)
    if len(digits)>=8: return digits
    return re.sub(r"[^a-z0-9@._-]+","",s)

def record_identifiers(record):
    vals=[]
    for k,v in record.items():
        if k in {"raw","source_filename","record_key"} or v is None: continue
        if isinstance(v,(dict,list)): continue
        s=clean(v)
        if not s: continue
        vals.append(norm_identifier(s))
        if k in {"caller","callee","from_account","to_account","sender_name","receiver_name","upi_id","ifsc","transaction_id"}:
            vals.append(norm_identifier(s))
    return {x for x in vals if x}

def add_highlight(records, conn, case_id, entity_id):
    if not entity_id: return records,0
    ids=entity_identifiers(conn,case_id,int(entity_id)); count=0
    for r in records:
        hit=bool(ids & record_identifiers(r))
        r["highlighted"]=hit
        r["highlight_entity_id"]=int(entity_id) if hit else None
        if hit: count+=1
    return records,count

def documents_for_kind(conn, case_id, kind):
    rows=conn.execute("SELECT id,filename,file_type,processing_status,uploaded_at,sha256,source_type FROM documents WHERE case_id=? ORDER BY uploaded_at DESC",(case_id,)).fetchall()
    result=[]
    for d in rows:
        n=clean(d["filename"]).lower(); t=clean(d["file_type"]).lower()
        if kind=="CDR" and ("cdr" in n or "call" in n or "communication" in n or "telecom" in n or t.startswith("audio/") or Path(n).suffix in {".wav",".mp3",".m4a",".ogg",".webm"}): result.append(dict(d))
        if kind=="FINANCIAL" and any(x in n for x in ("bank","statement","transaction","financial","ledger","rtgs","neft","upi","wallet")): result.append(dict(d))
    return result
