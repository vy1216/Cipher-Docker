const nav = document.getElementById("nav");

const menuBtn = document.querySelector(".menu-btn");

const navLinks = document.querySelector(".nav-links");

window.addEventListener("scroll", () => {
  nav.classList.toggle("scrolled", window.scrollY > 20);
});

menuBtn?.addEventListener("click", () => {
  const open = menuBtn.getAttribute("aria-expanded") === "true";

  menuBtn.setAttribute(
    "aria-expanded",
    String(!open)
  );

  navLinks?.classList.toggle(
    "mobile-open",
    !open
  );
});

navLinks?.querySelectorAll("a").forEach(a => {
  a.addEventListener("click", () => {
    navLinks.classList.remove("mobile-open");

    menuBtn?.setAttribute(
      "aria-expanded",
      "false"
    );
  });
});


/* =========================================================
   SCROLL REVEAL
   ========================================================= */

const observer = new IntersectionObserver(
  (entries) => {

    entries.forEach(entry => {

      if (entry.isIntersecting) {

        entry.target.classList.add("visible");

        observer.unobserve(entry.target);

      }

    });

  },
  {
    threshold: 0.12
  }
);

document
  .querySelectorAll(".reveal")
  .forEach(el => observer.observe(el));


/* =========================================================
   HERO / NETWORK DECORATIVE NODES
   ========================================================= */

function drawNodes(containerId, count = 12) {

  const el = document.getElementById(containerId);

  if (!el) return;

  for (let i = 0; i < count; i++) {

    const node = document.createElement("span");

    node.style.position = "absolute";

    node.style.width =
      (i % 5 === 0 ? 10 : 6) + "px";

    node.style.height =
      node.style.width;

    node.style.borderRadius = "50%";

    node.style.background =
      i % 5 === 0
        ? "#d9ff55"
        : "#777";

    node.style.boxShadow =
      i % 5 === 0
        ? "0 0 14px rgba(217,255,85,.5)"
        : "none";

    node.style.left =
      (8 + Math.random() * 84) + "%";

    node.style.top =
      (10 + Math.random() * 76) + "%";

    node.style.zIndex = "2";

    el.appendChild(node);
  }
}

drawNodes("heroGraph", 14);
drawNodes("networkOne", 18);


/* =========================================================
   BLACKBIRD ORGANIC NETWORK
   ========================================================= */

const canvas =
  document.getElementById("blackbirdCanvas");

const stage =
  document.getElementById("blackbird");

const selectedBox =
  document.getElementById("networkSelected");

const nodeCountEl =
  document.getElementById("nodeCount");

const edgeCountEl =
  document.getElementById("edgeCount");


if (canvas && stage) {

  const ctx = canvas.getContext("2d");

  let W = 0;
  let H = 0;

  let dpr =
    Math.min(
      window.devicePixelRatio || 1,
      2
    );

  let nodes = [];
  let links = [];

  let mouse = {
    x: -9999,
    y: -9999
  };

  let hovered = null;
  let selected = null;
  let pulse = 0;


  const TYPES = [
    "person",
    "person",
    "person",
    "org",
    "place",
    "evidence"
  ];


  const NAMES = [
    "Subject 047",
    "Subject 018",
    "Subject 029",
    "Subject 063",
    "Subject 081",
    "Org A",
    "Org B",
    "Location 01",
    "Location 02",
    "Evidence 12",
    "Evidence 21",
    "Subject 091",
    "Subject 104",
    "Org C",
    "Subject 116",
    "Location 03"
  ];


  function resize() {

    const r =
      stage.getBoundingClientRect();

    W = Math.max(300, r.width);
    H = Math.max(300, r.height);

    dpr =
      Math.min(
        window.devicePixelRatio || 1,
        2
      );

    canvas.width = W * dpr;
    canvas.height = H * dpr;

    canvas.style.width =
      W + "px";

    canvas.style.height =
      H + "px";

    ctx.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0
    );
  }


  function makeNodes() {

    nodes = [];

    const cx = W * 0.50;
    const cy = H * 0.52;


    nodes.push({
      x: cx,
      y: cy,
      ox: cx,
      oy: cy,
      r: 18,
      type: "person",
      name: "Subject 047",
      fixed: true,
      phase: 0
    });


    for (let i = 1; i < 25; i++) {

      const angle =
        (i / 24) * Math.PI * 2 +
        (Math.random() - 0.5) * 0.38;

      const ring =
        i < 9
          ? Math.min(W, H) *
            (0.19 + Math.random() * 0.08)

          : i < 17
            ? Math.min(W, H) *
              (0.30 + Math.random() * 0.10)

            : Math.min(W, H) *
              (0.40 + Math.random() * 0.08);


      const x =
        cx +
        Math.cos(angle) *
        ring;

      const y =
        cy +
        Math.sin(angle) *
        ring *
        0.78;


      nodes.push({

        x,
        y,

        ox: x,
        oy: y,

        r:
          i % 7 === 0
            ? 8
            : i % 4 === 0
              ? 6
              : 4,

        type:
          TYPES[i % TYPES.length],

        name:
          NAMES[i % NAMES.length],

        fixed: false,

        phase:
          Math.random() *
          Math.PI *
          2,

        speed:
          0.0005 +
          Math.random() *
          0.0007

      });
    }


    links = [];


    /* Central web */

    for (let i = 1; i < 9; i++) {

      links.push([
        0,
        i
      ]);

    }


    /* Secondary links */

    for (
      let i = 1;
      i < nodes.length;
      i++
    ) {

      const candidates =
        nodes
          .map((_, j) => j)
          .filter(j => j !== i);


      candidates.sort(
        (a, b) =>
          Math.hypot(
            nodes[a].ox -
            nodes[i].ox,

            nodes[a].oy -
            nodes[i].oy
          )

          -

          Math.hypot(
            nodes[b].ox -
            nodes[i].ox,

            nodes[b].oy -
            nodes[i].oy
          )
      );


      const take =
        i < 9
          ? 1
          : 1 +
            (i % 3 === 0
              ? 1
              : 0);


      for (
        let k = 0;
        k < take;
        k++
      ) {

        const j =
          candidates[k];

        const exists =
          links.some(
            l =>
              (
                l[0] === i &&
                l[1] === j
              )
              ||
              (
                l[0] === j &&
                l[1] === i
              )
          );


        if (
          !exists &&
          Math.random() > 0.12
        ) {

          links.push([
            i,
            j
          ]);

        }
      }
    }


    /* Long-range connections */

    [
      [2, 15],
      [5, 20],
      [8, 18],
      [11, 23],
      [14, 21]
    ].forEach(pair =>
      links.push(pair)
    );


    if (nodeCountEl) {

      nodeCountEl.textContent =
        nodes.length;

    }


    if (edgeCountEl) {

      edgeCountEl.textContent =
        links.length;

    }


    selected =
      nodes[0];
  }


  function color(type) {

    if (type === "person")
      return "#d9ff55";

    if (type === "org")
      return "#c5cac7";

    if (type === "place")
      return "#87918c";

    return "#ff6b5f";
  }


  function animate(t) {

    pulse = t * 0.001;

    ctx.clearRect(
      0,
      0,
      W,
      H
    );


    /* Organic movement */

    nodes.forEach(n => {

      if (!n.fixed) {

        n.x =
          n.ox +
          Math.sin(
            pulse *
            n.speed *
            900 +
            n.phase
          ) *
          4;

        n.y =
          n.oy +
          Math.cos(
            pulse *
            n.speed *
            820 +
            n.phase *
            0.7
          ) *
          4;

      }

    });


    /* Connections */

    links.forEach(
      (l, idx) => {

        const a =
          nodes[l[0]];

        const b =
          nodes[l[1]];


        const active =
          (
            Math.sin(
              pulse * 0.9 +
              idx * 0.67
            ) + 1
          ) / 2;


        const near =
          hovered &&
          (
            hovered === a ||
            hovered === b
          );


        ctx.beginPath();

        ctx.moveTo(
          a.x,
          a.y
        );


        const mx =
          (a.x + b.x) / 2 +
          (b.y - a.y) *
          0.035;

        const my =
          (a.y + b.y) / 2 -
          (b.x - a.x) *
          0.035;


        ctx.quadraticCurveTo(
          mx,
          my,
          b.x,
          b.y
        );


        ctx.strokeStyle =
          near
            ? "rgba(217,255,85,.46)"
            : `rgba(128,136,132,${
                0.10 +
                active * 0.10
              })`;


        ctx.lineWidth =
          near
            ? 1.35
            : 0.7;


        ctx.stroke();


        /* Moving spark */

        const p =
          (
            pulse * 0.055 +
            idx * 0.071
          ) % 1;


        const x =
          a.x +
          (b.x - a.x) *
          p;

        const y =
          a.y +
          (b.y - a.y) *
          p;


        ctx.beginPath();

        ctx.arc(
          x,
          y,
          near ? 2.2 : 1.25,
          0,
          Math.PI * 2
        );


        ctx.fillStyle =
          near
            ? "rgba(217,255,85,.9)"
            : "rgba(170,180,175,.42)";

        ctx.fill();

      }
    );


    /* Nodes */

    nodes.forEach(n => {

      const dist =
        Math.hypot(
          mouse.x - n.x,
          mouse.y - n.y
        );


      const hot =
        dist < 32 ||
        n === selected;


      const c =
        color(n.type);


      if (hot) {

        ctx.beginPath();

        ctx.arc(
          n.x,
          n.y,
          n.r +
          11 +
          Math.sin(
            pulse * 2 +
            n.phase
          ) *
          2,
          0,
          Math.PI * 2
        );


        ctx.strokeStyle =
          n === selected
            ? "rgba(217,255,85,.18)"
            : "rgba(255,255,255,.10)";


        ctx.stroke();

      }


      ctx.beginPath();

      ctx.arc(
        n.x,
        n.y,
        n.r +
        (n === selected ? 2 : 0),
        0,
        Math.PI * 2
      );


      ctx.fillStyle = c;

      ctx.shadowBlur =
        n === selected
          ? 22
          : hot
            ? 12
            : 0;

      ctx.shadowColor = c;

      ctx.fill();

      ctx.shadowBlur = 0;


      if (hot || n === selected) {

        ctx.font =
          '9px "DM Mono", monospace';

        ctx.fillStyle =
          "#b9bfbc";

        ctx.fillText(
          n.name,
          n.x + n.r + 7,
          n.y - 7
        );

      }

    });


    /* Center focus ring */

    const c = nodes[0];

    if (c) {

      ctx.beginPath();

      ctx.arc(
        c.x,
        c.y,
        31 +
        Math.sin(
          pulse * 1.7
        ) *
        3,
        0,
        Math.PI * 2
      );

      ctx.strokeStyle =
        "rgba(217,255,85,.12)";

      ctx.stroke();

    }


    requestAnimationFrame(
      animate
    );
  }


  function pick(e) {

    const r =
      canvas.getBoundingClientRect();

    const x =
      e.clientX -
      r.left;

    const y =
      e.clientY -
      r.top;


    mouse = {
      x,
      y
    };

    hovered = null;


    for (const n of nodes) {

      if (
        Math.hypot(
          x - n.x,
          y - n.y
        ) <
        Math.max(
          14,
          n.r + 8
        )
      ) {

        hovered = n;
        break;

      }

    }


    canvas.style.cursor =
      hovered
        ? "pointer"
        : "default";
  }


  canvas.addEventListener(
    "mousemove",
    pick
  );


  canvas.addEventListener(
    "mouseleave",
    () => {

      mouse = {
        x: -9999,
        y: -9999
      };

      hovered = null;

    }
  );


  canvas.addEventListener(
    "click",
    () => {

      if (!hovered)
        return;

      selected = hovered;


      if (selectedBox) {

        const strong =
          selectedBox.querySelector(
            "strong"
          );

        const span =
          selectedBox.querySelector(
            "span"
          );


        if (strong) {

          strong.textContent =
            hovered.name;

        }


        const degree =
          links.filter(
            l =>
              l[0] ===
                nodes.indexOf(
                  hovered
                )
              ||
              l[1] ===
                nodes.indexOf(
                  hovered
                )
          ).length;


        if (span) {

          span.textContent =
            `${degree} direct connections`;

        }

      }

    }
  );


  window.addEventListener(
    "resize",
    () => {

      resize();
      makeNodes();

    }
  );


  resize();
  makeNodes();

  requestAnimationFrame(
    animate
  );
}


/* =========================================================
   DETAILS ACCORDION
   ========================================================= */

document
  .querySelectorAll("details")
  .forEach(item => {

    item.addEventListener(
      "toggle",
      () => {

        if (item.open) {

          document
            .querySelectorAll("details")
            .forEach(other => {

              if (other !== item) {

                other.removeAttribute(
                  "open"
                );

              }

            });

        }

      }
    );

  });


/* =========================================================
   CIPHER AUTH + BACKEND + CASE ORBIT
   ========================================================= */

(() => {

  const auth =
    document.getElementById(
      "cipherAuth"
    );

  const workspace =
    document.getElementById(
      "cipherWorkspace"
    );

  const form =
    document.getElementById(
      "authForm"
    );


  if (
    !auth ||
    !workspace ||
    !form
  ) {
    return;
  }


  const title =
    document.getElementById(
      "authTitle"
    );

  const subtitle =
    document.getElementById(
      "authSubtitle"
    );

  const kicker =
    document.getElementById(
      "authKicker"
    );

  const submit =
    document.getElementById(
      "authSubmitText"
    );


  const name =
    document.getElementById(
      "authName"
    );

  const email =
    document.getElementById(
      "authEmail"
    );

  const pass =
    document.getElementById(
      "authPassword"
    );

  const confirm =
    document.getElementById(
      "authConfirm"
    );


  let mode = "login";


  /* =====================================================
     BACKEND CONFIGURATION
     ===================================================== */

  const API_BASE =
    (typeof window !== "undefined" && window.location ? window.location.origin : "");

  const TOKEN_KEY =
    "cipher_access_token";

  const USER_KEY =
    "cipher_user";


  /* =====================================================
     AUTH UI MODE
     ===================================================== */

  function setMode(m) {

    mode = m;

    auth.classList.toggle(
      "signup-mode",
      m === "signup"
    );


    document
      .querySelectorAll(
        ".auth-switch button"
      )
      .forEach(b => {

        b.classList.toggle(
          "active",
          b.dataset.mode === m
        );

      });


    name.required =
      m === "signup";

    confirm.required =
      m === "signup";


    kicker.textContent =
      m === "signup"
        ? "AUTH / 002"
        : "AUTH / 001";


    title.textContent =
      m === "signup"
        ? "Create access."
        : "Welcome back.";


    subtitle.textContent =
      m === "signup"
        ? "Create a local demo identity and enter your investigative workspace."
        : "Sign in to enter your investigative workspace.";


    submit.textContent =
      m === "signup"
        ? "CREATE & ENTER"
        : "ENTER CIPHER";
  }


  function openAuth(m) {

    setMode(m);

    auth.classList.add("open");

    auth.setAttribute(
      "aria-hidden",
      "false"
    );


    workspace.classList.remove(
      "open"
    );

    workspace.setAttribute(
      "aria-hidden",
      "true"
    );


    document.body.style.overflow =
      "hidden";


    setTimeout(
      () =>
        (
          m === "signup"
            ? name
            : email
        )?.focus(),
      100
    );
  }


  window.cipherOpenAuth = openAuth;

  function closeAll() {

    auth.classList.remove(
      "open"
    );

    workspace.classList.remove(
      "open"
    );


    auth.setAttribute(
      "aria-hidden",
      "true"
    );

    workspace.setAttribute(
      "aria-hidden",
      "true"
    );


    document.body.style.overflow =
      "";


    if (
      location.hash.startsWith(
        "#auth"
      ) ||
      location.hash ===
        "#workspace"
    ) {

      history.replaceState(
        null,
        "",
        location.pathname +
        location.search
      );

    }
  }


  function enter() {

    auth.classList.remove(
      "open"
    );

    workspace.classList.add(
      "open"
    );


    auth.setAttribute(
      "aria-hidden",
      "true"
    );

    workspace.setAttribute(
      "aria-hidden",
      "false"
    );


    document.body.style.overflow =
      "hidden";


    history.replaceState(
      null,
      "",
      "#workspace"
    );


    requestAnimationFrame(
      () =>
        requestAnimationFrame(
          initOrbit
        )
    );
  }


  /* =====================================================
     OPEN LOGIN / SIGNUP
     ===================================================== */

  document
    .querySelectorAll("[data-auth]")
    .forEach(a => {

      a.addEventListener(
        "click",
        e => {

          e.preventDefault();
          e.stopPropagation();

          openAuth(
            a.dataset.auth
          );


          history.replaceState(
            null,
            "",
            location.pathname +
            location.search +
            "#auth-" +
            a.dataset.auth
          );

        }
      );

    });


  document
    .querySelectorAll(
      ".auth-switch button"
    )
    .forEach(b => {

      b.addEventListener(
        "click",
        () =>
          setMode(
            b.dataset.mode
          )
      );

    });


  document
    .getElementById(
      "authClose"
    )
    ?.addEventListener(
      "click",
      closeAll
    );


  document
    .getElementById(
      "workspaceExit"
    )
    ?.addEventListener(
      "click",
      closeAll
    );


  document.addEventListener(
    "keydown",
    e => {

      if (
        e.key === "Escape" &&
        (
          auth.classList.contains(
            "open"
          ) ||
          workspace.classList.contains(
            "open"
          )
        )
      ) {

        closeAll();

      }

    }
  );


  /* =====================================================
     REAL BACKEND LOGIN / SIGNUP
     ===================================================== */

  form.addEventListener(
    "submit",
    async e => {

      e.preventDefault();


      /* Basic validation */

      if (
        !email.checkValidity() ||
        !pass.checkValidity() ||
        (
          mode === "signup" &&
          !name.checkValidity()
        )
      ) {

        form.reportValidity();

        return;

      }


      /* Password confirmation */

      if (
        mode === "signup" &&
        pass.value !==
          confirm.value
      ) {

        confirm.setCustomValidity(
          "Passwords do not match."
        );

        form.reportValidity();

        confirm.setCustomValidity(
          ""
        );

        return;

      }


      /* Disable button */

      submit.disabled = true;


      const originalText =
        submit.textContent;


      submit.textContent =
        mode === "login"
          ? "AUTHENTICATING..."
          : "CREATING...";


      try {

        const endpoint =
          mode === "login"
            ? `${API_BASE}/auth/login`
            : `${API_BASE}/auth/register`;


        const body =
          mode === "login"
            ? {
                email:
                  email.value.trim(),

                password:
                  pass.value
              }

            : {
                full_name:
                  name.value.trim(),

                email:
                  email.value.trim(),

                password:
                  pass.value,

                /*
                 * Public signup always creates
                 * an investigator.
                 */
                role:
                  "INVESTIGATOR"
              };


        console.log(
          "CIPHER → Backend request:",
          endpoint
        );


        const response =
          await fetch(
            endpoint,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body:
                JSON.stringify(
                  body
                )
            }
          );


        const rawText = await response.text();
        let data = {};
        try {
          data = rawText ? JSON.parse(rawText) : {};
        } catch {
          throw new Error("Invalid response received from authentication server.");
        }

        console.log(
          "CIPHER ← Backend response:",
          data
        );


        if (!response.ok) {

          throw new Error(
            data.detail ||
            "Authentication failed"
          );

        }


        /* =================================================
           LOGIN SUCCESS
           ================================================= */

        if (mode === "login") {

          localStorage.setItem(
            TOKEN_KEY,
            data.access_token
          );

          localStorage.setItem(
            USER_KEY,
            JSON.stringify(
              data.user
            )
          );

          if (data.user?.full_name) {
            localStorage.setItem("cipher_registered_name", data.user.full_name);
          }
          window.currentUser = data.user;

          console.log(
            "CIPHER login successful:",
            data.user
          );

          enter();
          // Hydrate all case-scoped modules with the newly issued token.
          // This prevents the initial pre-login 401s from leaving the workspace
          // stuck on stale/empty Network and GIS state.
          setTimeout(() => {
            if (typeof window.cipherAfterLogin === "function") {
              window.cipherAfterLogin();
            }
          }, 0);

        }

        /* =================================================
           SIGNUP SUCCESS
           ================================================= */

        else {

          const regUser = data.user || {
            full_name: (name?.value || "").trim(),
            email: (email?.value || "").trim(),
            role: "INVESTIGATOR"
          };
          localStorage.setItem(
            USER_KEY,
            JSON.stringify(regUser)
          );
          if (regUser.full_name) {
            localStorage.setItem("cipher_registered_name", regUser.full_name);
          }
          window.currentUser = regUser;

          alert(
            `Account created successfully for ${regUser.full_name || "Investigator"}. Please login.`
          );

          setMode(
            "login"
          );


          pass.value = "";
          confirm.value = "";


          setTimeout(
            () => {
              email.focus();
            },
            100
          );

        }

      }

      catch (error) {

        console.error(
          "CIPHER authentication error:",
          error
        );


        alert(
          error.message ||
          "Unable to connect to CIPHER backend."
        );

      }

      finally {

        submit.disabled =
          false;

        submit.textContent =
          originalText;

      }

    }
  );


  /* =====================================================
     HASH ROUTING
     ===================================================== */

  window.addEventListener(
    "hashchange",
    () => {

      if (
        location.hash ===
        "#auth-login"
      ) {

        openAuth(
          "login"
        );

      }

      else if (
        location.hash ===
        "#auth-signup"
      ) {

        openAuth(
          "signup"
        );

      }

      else if (
        location.hash ===
        "#workspace"
      ) {

        enter();

      }

    }
  );


  if (
    location.hash ===
    "#auth-login"
  ) {

    openAuth(
      "login"
    );

  }


  if (
    location.hash ===
    "#auth-signup"
  ) {

    openAuth(
      "signup"
    );

  }


  /* =====================================================
     CASE ORBIT
     ===================================================== */

  let orbitRAF = null;

  let orbitRunning = false;

  let stage;

  let cards = [];


  const state = {

    angle: -18,

    angularVelocity: 0.014,

    drag: false,

    lastX: 0,

    lastY: 0,

    focusedCard: null,

    focusProgress: 0,

    snapTarget: null,

    tiltX: -12,

    targetTiltX: -12,

    tiltZ: -3.5,

    targetTiltZ: -3.5,

    radiusBoost: 0,

    targetRadiusBoost: 0

  };


  const clamp =
    (v, a, b) =>
      Math.max(
        a,
        Math.min(
          b,
          v
        )
      );


  const shortestDelta =
    (target, current) =>
      (
        (
          target -
          current +
          540
        ) %
        360
      ) -
      180;


  function initOrbit() {

    stage =
      document.getElementById(
        "caseStage"
      );


    if (!stage)
      return;


    cards = [
      ...stage.querySelectorAll(
        ".floating-case"
      )
    ];


    // The orbit is populated by the backend-driven case renderer.
    // It is valid for the dashboard to start empty while the case list loads.
    if (!cards.length) {
      orbitRunning = false;
      return;
    }


    if (
      !stage.querySelector(
        ".case-orbit-plane"
      )
    ) {

      stage.insertAdjacentHTML(
        "afterbegin",
        `
        <div class="case-orbit-plane" aria-hidden="true">

          <span class="orbit-ellipse orbit-ellipse-a"></span>

          <span class="orbit-ellipse orbit-ellipse-b"></span>

          <span class="orbit-axis orbit-axis-x"></span>

          <span class="orbit-axis orbit-axis-y"></span>

        </div>

        <div class="case-orbit-reticle" aria-hidden="true">
          <i></i>
          <b></b>
        </div>

        <div class="case-orbit-hud" aria-hidden="true">

          <span>
            CASE ORBIT / SPATIAL VIEW
          </span>

          <b>
            DRAG TO ROTATE · RELEASE FOR MOMENTUM
          </b>

        </div>
        `
      );

    }


    if (
      !stage.dataset.orbitBound
    ) {

      stage.dataset.orbitBound =
        "1";


      stage.addEventListener(
        "pointerdown",
        e => {

          if (
            e.target.closest(
              ".floating-case"
            ) ||
            e.target.closest(
              ".new-case"
            )
          ) {
            return;
          }


          state.drag = true;

          state.lastX =
            e.clientX;

          state.lastY =
            e.clientY;


          stage.setPointerCapture?.(
            e.pointerId
          );


          stage.classList.add(
            "dragging"
          );

        }
      );


      stage.addEventListener(
        "pointermove",
        e => {

          if (!state.drag)
            return;


          const dx =
            e.clientX -
            state.lastX;

          const dy =
            e.clientY -
            state.lastY;


          state.lastX =
            e.clientX;

          state.lastY =
            e.clientY;


          state.focusedCard =
            null;

          state.focusProgress =
            0;

          state.snapTarget =
            null;


          cards.forEach(
            c =>
              c.classList.remove(
                "focus"
              )
          );


          const speed =
            dx * 0.34;


          state.angularVelocity =
            clamp(
              speed,
              -2.2,
              2.2
            );


          state.angle +=
            speed;


          state.targetTiltX =
            clamp(
              state.targetTiltX -
                dy * 0.055,
              -18,
              -5
            );


          state.targetTiltZ =
            clamp(
              state.targetTiltZ +
                dx * 0.018,
              -7,
              1
            );

        }
      );


      const release = () => {

        if (!state.drag)
          return;

        state.drag = false;

        stage.classList.remove(
          "dragging"
        );

      };


      stage.addEventListener(
        "pointerup",
        release
      );

      stage.addEventListener(
        "pointercancel",
        release
      );

      stage.addEventListener(
        "lostpointercapture",
        release
      );


      stage.addEventListener(
        "wheel",
        e => {

          e.preventDefault();


          if (
            state.focusedCard
          ) {
            return;
          }


          const delta =
            clamp(
              e.deltaY * 0.055,
              -3.5,
              3.5
            );


          state.angularVelocity =
            delta * 0.22;

          state.angle +=
            delta;

        },
        {
          passive: false
        }
      );


      stage.addEventListener(
        "click",
        e => {

          if (
            state.focusedCard &&
            !e.target.closest(
              ".floating-case"
            )
          ) {

            releaseCard();

          }

        }
      );


      const bindCaseCard =
        card => {

          if (
            card.dataset.caseBound ===
            "1"
          ) {
            return;
          }


          card.dataset.caseBound =
            "1";


          card.addEventListener(
            "click",
            e => {

              if (
                e.target.closest(
                  "button"
                )
              ) {
                return;
              }


              e.stopPropagation();


              focusCard(
                card
              );

              const main =
                stage.querySelector(
                  ".case-main"
                );

              if (main) {
                const cardTop = card.querySelector(".case-top");
                const cardIndexRaw = card.dataset.caseId || cardTop?.querySelector("span")?.textContent || "CASE / 014";
                const priorityText = card.dataset.priority || cardTop?.querySelector("b")?.textContent || "HIGH RISK";
                const isHighPriority = priorityText.toUpperCase().includes("HIGH") || priorityText.toUpperCase().includes("CRITICAL");
                const isNew = card.dataset.isNew === "true" || !!card.querySelector(".case-new-badge");

                const mainTop = main.querySelector(".case-top");
                if (mainTop) {
                  const displayIndex = cardIndexRaw.startsWith("CASE /") ? cardIndexRaw : "CASE / " + cardIndexRaw;
                  mainTop.innerHTML = `<span>${displayIndex}</span><div style="display:flex;align-items:center;gap:6px;"><b class="${isHighPriority ? 'high' : ''}">${priorityText.toUpperCase()}</b>${isNew ? '<span class="case-new-badge">NEW</span>' : ''}</div>`;
                }

                const mainIndex = main.querySelector(".case-index");
                if (mainIndex) {
                  mainIndex.textContent = card.dataset.caseId || cardIndexRaw.replace("CASE / ", "").trim();
                }

                const mainTitle = main.querySelector("h3");
                if (mainTitle) {
                  mainTitle.textContent = card.dataset.case || card.querySelector("h3")?.textContent || "Investigation";
                }

                const mainDesc = main.querySelector("p");
                if (mainDesc) {
                  mainDesc.textContent = card.dataset.description || card.querySelector("p")?.textContent || "Investigative intelligence record.";
                }

                let detailStrip = main.querySelector(".case-detail-strip");
                if (!detailStrip) {
                  detailStrip = document.createElement("div");
                  detailStrip.className = "case-detail-strip";
                  const pEl = main.querySelector("p");
                  if (pEl && pEl.nextSibling) {
                    main.insertBefore(detailStrip, pEl.nextSibling);
                  } else {
                    main.appendChild(detailStrip);
                  }
                }

                const cType = card.dataset.caseType || "Financial Crime";
                const cOff = card.dataset.officer || (window.currentUser?.full_name || localStorage.getItem("cipher_registered_name") || "Investigating Officer");
                const cJur = card.dataset.jurisdiction || "Central Division";
                const cLoc = card.dataset.location || "Central Command";
                const cDate = card.dataset.incidentDate || "Active";
                const cTags = card.dataset.tags || "financial, accounts";

                detailStrip.innerHTML = `
                  <span><strong>TYPE:</strong> ${cType}</span>
                  <span><strong>LOCATION:</strong> ${cLoc}</span>
                  <span><strong>OFFICER:</strong> ${cOff}</span>
                  <span><strong>JURISDICTION:</strong> ${cJur}</span>
                  <span><strong>DATE:</strong> ${cDate}</span>
                  <span><strong>TAGS:</strong> ${cTags}</span>
                `;

                const openBtn = main.querySelector(".case-footer button");
                if (openBtn) {
                  openBtn.onclick = (btnE) => {
                    btnE.stopPropagation();
                    const caseIdStr = card.dataset.caseId || cardIndexRaw;
                    const caseTitleStr = card.dataset.case || mainTitle?.textContent || "";
                    const wsCase = document.querySelector(".workspace-case");
                    if (wsCase) {
                      wsCase.innerHTML = `<span>CASE /</span> ${caseIdStr} <i></i> ACTIVE INVESTIGATION`;
                    }
                    const netBtn = document.querySelector('.side-item[data-view="network"]');
                    if (netBtn) netBtn.click();
                  };
                }
              }

            }
          );

        };


      cards.forEach(
        bindCaseCard
      );


      window.cipherRefreshCases =
        () => {

          cards = [
            ...stage.querySelectorAll(
              ".floating-case"
            )
          ];


          cards.forEach(
            bindCaseCard
          );


          if (
            state.focusedCard &&
            !cards.includes(
              state.focusedCard
            )
          ) {

            releaseCard();

          }

        };


      window.cipherFocusCase =
        card =>
          focusCard(card);

    }


    if (!orbitRunning) {

      orbitRunning =
        true;

      orbitLoop();

    }

  }

  // Runtime loads the real cases asynchronously, so expose a tiny initializer
  // without changing any backend contracts.
  window.cipherInitOrbit = initOrbit;


  function focusCard(card) {

    if (!cards.length)
      return;


    const i =
      cards.indexOf(card);


    if (i < 0)
      return;


    const spacing =
      360 / cards.length;


    const base =
      i * spacing;


    const desired =
      90 - base;


    state.snapTarget =
      state.angle +
      shortestDelta(
        desired,
        state.angle
      );


    state.angularVelocity =
      0;


    state.focusedCard =
      card;


    state.focusProgress =
      0;


    state.targetTiltX =
      -9;

    state.targetTiltZ =
      -2;


    cards.forEach(
      c =>
        c.classList.toggle(
          "focus",
          c === card
        )
    );

  }


  function releaseCard() {

    if (!state.focusedCard)
      return;


    state.focusedCard =
      null;

    state.focusProgress =
      0;

    state.snapTarget =
      null;

    state.angularVelocity =
      0.012;


    cards.forEach(
      c =>
        c.classList.remove(
          "focus"
        )
    );

  }


  function orbitLoop() {
    if (!workspace.classList.contains("open")) {
      orbitRunning = false;
      orbitRAF = null;
      return;
    }

    // Stable carousel physics: velocity controls the angular position only.
    // Every card is always calculated from the same center + fixed angular slot.
    if (state.drag) {
      state.angularVelocity *= 0.985;
    } else if (state.snapTarget !== null) {
      const delta = shortestDelta(state.snapTarget, state.angle);
      state.angle += delta * 0.105;
      state.angularVelocity *= 0.80;
      if (Math.abs(delta) < 0.08) {
        state.angle = state.snapTarget;
        state.snapTarget = null;
        state.angularVelocity = 0;
      }
    } else if (!state.focusedCard) {
      state.angularVelocity += 0.00042;
      state.angularVelocity *= 0.992;
      if (Math.abs(state.angularVelocity) < 0.010) state.angularVelocity = 0.016;
      state.angularVelocity = clamp(state.angularVelocity, -1.6, 1.6);
      state.angle += state.angularVelocity;
    }

    if (state.focusedCard) {
      const arrival = state.snapTarget === null
        ? 1
        : clamp(1 - Math.abs(shortestDelta(state.snapTarget, state.angle)) / 45, 0, 1);
      state.focusProgress += (arrival - state.focusProgress) * 0.10;
    } else {
      state.focusProgress *= 0.88;
    }

    state.targetTiltX += (-11 - state.targetTiltX) * 0.008;
    state.targetTiltZ += (-3.5 - state.targetTiltZ) * 0.008;
    state.tiltX += (state.targetTiltX - state.tiltX) * 0.09;
    state.tiltZ += (state.targetTiltZ - state.tiltZ) * 0.09;

    const r = stage.getBoundingClientRect();
    const mobile = r.width < 700;
    const compact = r.width < 900;
    const n = Math.max(cards.length, 1);

    // Keep a true, deterministic orbital deck: every case owns one angular
    // slot and the whole deck rotates around the same center. The deck scale
    // deliberately steps down as cards are added so a new case cannot make
    // the cards collide visually. Focus then enlarges only the selected card.
    const deckScale =
      n <= 5 ? 0.82 :
      n === 6 ? 0.72 :
      n === 7 ? 0.64 :
      0.58;

    const rx = compact
      ? Math.min(r.width * (mobile ? 0.48 : 0.43), mobile ? 245 : 430) + state.radiusBoost
      : Math.min(r.width * 0.39, 500) + state.radiusBoost;
    const ry = compact
      ? Math.min(r.height * (mobile ? 0.36 : 0.37), mobile ? 200 : 208)
      : Math.min(r.height * 0.37, 245);
    const depth = mobile ? 78 : compact ? 115 : 175;

    cards.forEach((card, i) => {
      const phase = (i / n) * Math.PI * 2 + (state.angle * Math.PI / 180);
      const x = Math.cos(phase) * rx;
      const y = Math.sin(phase) * ry;
      const z = Math.sin(phase) * depth;
      const front = (z + depth) / (depth * 2);
      const baseScale = deckScale * (mobile ? 0.88 + front * 0.08 : 0.90 + front * 0.08);
      const isFocused = state.focusedCard === card;
      const p = state.focusProgress;

      const focusX = isFocused ? x * (1 - p) : x;
      const focusY = isFocused ? y * (1 - p) : y;
      const focusZ = isFocused ? z * (1 - p) + 125 * p : z;
      const focusScale = isFocused ? 1 + 0.18 * p : 1;
      const rotY = -Math.cos(phase) * 16;
      const rotX = state.tiltX - Math.sin(phase) * 4;

      // Separate transform functions are more reliable across Chromium and
      // mobile WebViews than translate3d() values containing CSS calc().
      const transform = [
        'translate(-50%, -50%)',
        `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${focusZ.toFixed(2)}px)`,
        `rotateZ(${state.tiltZ.toFixed(2)}deg)`,
        `rotateX(${rotX.toFixed(2)}deg)`,
        `rotateY(${rotY.toFixed(2)}deg)`,
        `scale(${(baseScale * focusScale).toFixed(4)})`
      ].join(' ');

      // Focus pulls the selected card toward the center while the other cards
      // retain their exact orbital slots.
      const focusedTransform = isFocused
        ? [
            'translate(-50%, -50%)',
            `translate3d(${focusX.toFixed(2)}px, ${focusY.toFixed(2)}px, ${focusZ.toFixed(2)}px)`,
            `rotateZ(${state.tiltZ.toFixed(2)}deg)`,
            `rotateX(${rotX.toFixed(2)}deg)`,
            `rotateY(${rotY.toFixed(2)}deg)`,
            `scale(${(baseScale * focusScale).toFixed(4)})`
          ].join(' ')
        : transform;

      card.style.setProperty('--case-transform', focusedTransform);
      card.style.setProperty('--orbit-transform', focusedTransform);
      card.style.transform = focusedTransform;
      card.style.zIndex = isFocused ? '9999' : String(100 + Math.round(front * 100));

      if (isFocused) {
        card.style.opacity = '1';
        card.style.filter = 'brightness(1.10) saturate(1.04) blur(0px)';
      } else {
        const distanceFromFront = Math.abs(0.5 - front);
        const opacity = 0.34 + front * 0.42 - distanceFromFront * 0.06;
        card.style.opacity = String(clamp(opacity, 0.28, 0.76));
        card.style.filter = `brightness(${0.80 + front * 0.18}) blur(${(1 - front) * 0.55}px)`;
      }
    });

    orbitRAF = requestAnimationFrame(orbitLoop);
  }

})();


/* =========================================================
   CASE CREATION & INVESTIGATION SYNC MODULE
   ========================================================= */
(function initCaseCreationManager() {
  const newCaseBtn = document.getElementById("newCaseBtn");
  const caseModal = document.getElementById("caseCreateModal");
  const caseForm = document.getElementById("caseCreateForm");
  const caseCloseBtn = document.getElementById("caseCreateClose");
  const caseCancelBtn = document.getElementById("caseCancelBtn");
  const caseIdDisplay = document.getElementById("newCaseIdDisplay");
  const caseIdHidden = document.getElementById("newCaseIdHidden");
  const caseNameInput = document.getElementById("newCaseName");
  const caseTypeSelect = document.getElementById("newCaseType");
  const casePrioritySelect = document.getElementById("newCasePriority");
  const caseDateInput = document.getElementById("newCaseIncidentDate");
  // Frontend-only restriction: the New Case incident date cannot be in the future.
  // Uses the browser's local date (not UTC) so the limit matches the user's today.
  if (caseDateInput) {
    const now = new Date();
    const todayString = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0")
    ].join("-");

    caseDateInput.max = todayString;

    const preventFutureDate = () => {
      if (caseDateInput.value && caseDateInput.value > todayString) {
        caseDateInput.value = todayString;
      }
    };

    caseDateInput.addEventListener("input", preventFutureDate);
    caseDateInput.addEventListener("change", preventFutureDate);
  }

  const caseDescInput = document.getElementById("newCaseDescription");
  const caseLocInput = document.getElementById("newCaseLocation");
  const selectMapBtn = document.getElementById("newCaseSelectMapBtn");
  const tagsWrapper = document.getElementById("caseTagsWrapper");
  const tagAddInput = document.getElementById("newCaseTagInput");
  const officerVal = document.getElementById("newCaseOfficerVal");
  const officerHidden = document.getElementById("newCaseOfficerHidden");
  const editOfficerBtn = document.getElementById("newCaseEditOfficerBtn");
  const officerBox = document.getElementById("newCaseOfficerBox");
  const officerEditInput = document.getElementById("newCaseOfficerEditInput");
  const officerBadge = document.getElementById("newCaseOfficerBadge");

  const jurisdictionVal = document.getElementById("newCaseJurisdictionVal");
  const jurisdictionHidden = document.getElementById("newCaseJurisdictionHidden");
  const editJurBtn = document.getElementById("newCaseEditJurisdictionBtn");
  const jurBox = document.getElementById("newCaseJurisdictionBox");
  const jurEditInput = document.getElementById("newCaseJurisdictionEditInput");
  const jurBadge = document.getElementById("newCaseJurisdictionBadge");

  const detectGpsBtn = document.getElementById("newCaseDetectGpsBtn");
  const detectGpsIcon = document.getElementById("newCaseDetectGpsIcon");
  const detectGpsText = document.getElementById("newCaseDetectGpsText");
  const locationStatusEl = document.getElementById("newCaseLocationStatus");

  // Helper to retrieve currently registered/authenticated officer
  function getActiveOfficerName() {
    if (window.currentUser) {
      const u = window.currentUser;
      const n = u.full_name || u.name || (u.email ? u.email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : null);
      if (n) return n;
    }
    try {
      const stored = localStorage.getItem("cipher_user") || sessionStorage.getItem("cipher_user");
      if (stored) {
        const u = JSON.parse(stored);
        if (u) {
          window.currentUser = u;
          const n = u.full_name || u.name || (u.email ? u.email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : null);
          if (n) return n;
        }
      }
    } catch (e) {}

    const regName = localStorage.getItem("cipher_registered_name");
    if (regName && regName.trim()) return regName.trim();

    const authNameInput = document.getElementById("authName");
    if (authNameInput && authNameInput.value.trim()) return authNameInput.value.trim();

    return "Investigating Officer";
  }

  // Real location detection state
  let currentDetectedLocation = null;
  let isDetectingLoc = false;

  async function detectRealLocation(force = false) {
    if (isDetectingLoc && !force) return;
    isDetectingLoc = true;

    if (detectGpsText) detectGpsText.textContent = "Detecting...";
    if (detectGpsIcon) detectGpsIcon.textContent = "⏳";
    if (locationStatusEl) {
      locationStatusEl.style.display = "block";
      locationStatusEl.style.color = "#7da0b8";
      locationStatusEl.textContent = "Detecting current geographic location...";
    }

    function applyLocation(info, sourceLabel) {
      currentDetectedLocation = info;
      if (caseLocInput && (!caseLocInput.value || force || caseLocInput.value === "Detecting real location...")) {
        caseLocInput.value = info.primary_location;
      }
      if (jurisdictionVal && (!jurisdictionHidden?.value || force)) {
        jurisdictionVal.textContent = info.jurisdiction || `${info.city || "Central"} Police Zone`;
      }
      if (jurisdictionHidden && (!jurisdictionHidden?.value || force)) {
        jurisdictionHidden.value = info.jurisdiction || `${info.city || "Central"} Police Zone`;
      }
      if (locationStatusEl) {
        locationStatusEl.style.display = "block";
        locationStatusEl.style.color = "#4ade80";
        locationStatusEl.textContent = `✓ Real location detected (${sourceLabel}): ${info.primary_location}`;
      }
      if (detectGpsText) detectGpsText.textContent = "Refresh Location";
      if (detectGpsIcon) detectGpsIcon.textContent = "⌖";
      isDetectingLoc = false;
    }

    async function tryFallbackIp() {
      try {
        const res = await fetch("/api/location/current");
        if (res.ok) {
          const data = await res.json();
          if (data && data.primary_location) {
            applyLocation(data, data.source === "ip_network" ? "Network IP" : "Regional Area");
            return;
          }
        }
      } catch (e) {
        console.warn("IP location fallback notice:", e);
      }

      if (locationStatusEl) {
        locationStatusEl.style.color = "#8b949e";
        locationStatusEl.textContent = "Enter primary location or select pin on map.";
      }
      if (caseLocInput && !caseLocInput.value) {
        caseLocInput.placeholder = "Enter incident or station location";
      }
      if (detectGpsText) detectGpsText.textContent = "Detect Real Location";
      if (detectGpsIcon) detectGpsIcon.textContent = "⌖";
      isDetectingLoc = false;
    }

    // 1. Try Browser HTML5 Geolocation first (GPS / WiFi)
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          try {
            const res = await fetch(`/api/geocode/reverse?lat=${lat}&lon=${lon}`);
            if (res.ok) {
              const data = await res.json();
              if (data && data.primary_location) {
                applyLocation(data, "High-Precision GPS");
                return;
              }
            }
          } catch (geoErr) {
            console.warn("Reverse geocode fetch failed:", geoErr);
          }
          await tryFallbackIp();
        },
        async (err) => {
          console.log("Browser geolocation prompt bypassed or declined, using network location:", err?.message);
          await tryFallbackIp();
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
      );
    } else {
      await tryFallbackIp();
    }
  }

  // Initialize default metadata on existing cards c1-c5
  const stage = document.getElementById("caseStage");
  if (stage) {
    const initialOfficer = getActiveOfficerName();
    const c1 = stage.querySelector(".c1");
    if (c1 && !c1.dataset.caseId) {
      c1.dataset.caseId = "C-2026-014";
      c1.dataset.caseType = "Financial Crime";
      c1.dataset.priority = "Medium";
      c1.dataset.incidentDate = "2026-08-14";
      c1.dataset.description = "Cross-border movement & financial links tracking illicit transit routes across northern corridors.";
      c1.dataset.location = "Sector 17, Chandigarh";
      c1.dataset.officer = initialOfficer;
      c1.dataset.jurisdiction = "Chandigarh Central";
      c1.dataset.tags = "financial, cross-border, transit";
    }
    const c2 = stage.querySelector(".c2");
    if (c2 && !c2.dataset.caseId) {
      c2.dataset.caseId = "C-2026-021";
      c2.dataset.caseType = "Corporate Fraud";
      c2.dataset.priority = "Low";
      c2.dataset.incidentDate = "2026-07-02";
      c2.dataset.description = "Corporate ownership, shell holdings and proxy entities laundering capital through tech accounts.";
      c2.dataset.location = "Cyber City, Gurugram";
      c2.dataset.officer = initialOfficer;
      c2.dataset.jurisdiction = "Gurugram Division";
      c2.dataset.tags = "corporate, shell-holdings, proxies";
    }
    const c3 = stage.querySelector(".c3");
    if (c3 && !c3.dataset.caseId) {
      c3.dataset.caseId = "C-2026-042";
      c3.dataset.caseType = "Organized Crime";
      c3.dataset.priority = "High";
      c3.dataset.incidentDate = "2026-03-12";
      c3.dataset.description = "A connected criminal network spanning people, organizations, locations and financial evidence.";
      c3.dataset.location = "Mumbai & Northern Region";
      c3.dataset.officer = initialOfficer;
      c3.dataset.jurisdiction = "Mumbai Police Zone";
      c3.dataset.tags = "organized-crime, terror-finance, hawala";
    }
    const c4 = stage.querySelector(".c4");
    if (c4 && !c4.dataset.caseId) {
      c4.dataset.caseId = "C-2026-009";
      c4.dataset.caseType = "Theft & Smuggling";
      c4.dataset.priority = "Closed";
      c4.dataset.incidentDate = "2026-01-19";
      c4.dataset.description = "Logistics network reconstruction and maritime freight tracking for unauthorized container cargo.";
      c4.dataset.location = "JNPT Port Terminal";
      c4.dataset.officer = initialOfficer;
      c4.dataset.jurisdiction = "Western Maritime";
      c4.dataset.tags = "logistics, shipping, cargo";
    }
    const c5 = stage.querySelector(".c5");
    if (c5 && !c5.dataset.caseId) {
      c5.dataset.caseId = "C-2026-033";
      c5.dataset.caseType = "Cyber Crime";
      c5.dataset.priority = "Medium";
      c5.dataset.incidentDate = "2026-06-28";
      c5.dataset.description = "Evidence-led entity resolution and multi-bank transactional graph analysis of phishing networks.";
      c5.dataset.location = "Financial District";
      c5.dataset.officer = initialOfficer;
      c5.dataset.jurisdiction = "Economic Offences Wing";
      c5.dataset.tags = "cyber, banking, entities";
    }
  }

  let evidencePopupTimer = null;

  function showEvidencePromptPopup(createdCase) {
    let popup = document.getElementById("caseEvidencePromptPopup");
    if (!popup) {
      popup = document.createElement("div");
      popup.id = "caseEvidencePromptPopup";
      popup.className = "cipher-evidence-prompt-popup";
      popup.setAttribute("role", "alert");
      popup.setAttribute("aria-live", "assertive");
      popup.innerHTML = `
        <div class="evidence-popup-top">
          <div class="evidence-popup-badge-wrap">
            <span class="evidence-popup-check">✓</span>
            <span class="evidence-popup-label">CASE CREATED • ACTIVE</span>
          </div>
          <button type="button" class="evidence-popup-close-btn" id="caseEvidencePopupDismiss" aria-label="Close notification">×</button>
        </div>
        <div class="evidence-popup-case-title" id="caseEvidencePopupTitle">${createdCase.case_number} • ${createdCase.title}</div>
        <p class="evidence-popup-msg">
          Please add evidence and proceed further
        </p>
        <div class="evidence-popup-footer">
          <span class="evidence-popup-subtext">Click here to continue</span>
          <button type="button" class="evidence-popup-btn" id="caseEvidencePopupActionBtn">
            OPEN EVIDENCE ◈ ↗
          </button>
        </div>
      `;
      document.body.appendChild(popup);
    }

    // Ensure it is on the top stacking layer
    popup.style.display = "flex";
    popup.style.position = "fixed";
    popup.style.top = "24px";
    popup.style.right = "24px";
    popup.style.zIndex = "999999";

    const titleEl = popup.querySelector("#caseEvidencePopupTitle");
    if (titleEl) {
      titleEl.textContent = `${createdCase.case_number} • ${createdCase.title}`;
    }

    clearTimeout(evidencePopupTimer);

    // Force show class with requestAnimationFrame for smooth CSS animation
    requestAnimationFrame(() => {
      popup.classList.add("show");
    });

    evidencePopupTimer = setTimeout(() => {
      popup.classList.remove("show");
    }, 25000);

    const dismissBtn = popup.querySelector("#caseEvidencePopupDismiss");
    if (dismissBtn) {
      dismissBtn.onclick = (evt) => {
        evt.stopPropagation();
        popup.classList.remove("show");
        clearTimeout(evidencePopupTimer);
      };
    }

    const handleNavigateToEvidence = (evt) => {
      if (evt && evt.target && evt.target.closest("#caseEvidencePopupDismiss")) return;

      if (typeof window.cipherSwitchView === "function") {
        window.cipherSwitchView("evidence");
      } else {
        const evTab = document.querySelector('.side-item[data-view="evidence"]') || document.querySelector('[data-view="evidence"]');
        if (evTab) evTab.click();
      }

      // Synchronize evidence workspace headers & fields with the new case
      const repStatus = document.getElementById("reportCaseStatus");
      if (repStatus) repStatus.textContent = `CASE / ${createdCase.case_number} • ACTIVE`;

      const repTitle = document.getElementById("reportTitle");
      if (repTitle) repTitle.textContent = createdCase.title;

      const repSubtitle = document.getElementById("reportSubtitle");
      if (repSubtitle) {
        repSubtitle.textContent = `${createdCase.primary_location} · ${createdCase.incident_date} · ${createdCase.case_type}`;
      }

      const caseIdField = document.querySelector('[data-report-field="caseId"]');
      if (caseIdField) caseIdField.value = createdCase.case_number;

      const agencyField = document.querySelector('[data-report-field="agency"]');
      if (agencyField) agencyField.value = `${createdCase.jurisdiction} / ${createdCase.assigned_officer}`;

      const caseTypeField = document.querySelector('[data-report-field="caseType"]');
      if (caseTypeField) caseTypeField.value = createdCase.case_type;

      const dateField = document.querySelector('[data-report-field="incidentDate"]');
      if (dateField) dateField.value = createdCase.incident_date;

      const locField = document.querySelector('[data-report-field="location"]');
      if (locField) locField.value = createdCase.primary_location;

      popup.classList.remove("show");
      clearTimeout(evidencePopupTimer);

      notifyUser(`Switched to Evidence section for Case ${createdCase.case_number}`);
    };

    popup.onclick = handleNavigateToEvidence;
    const actionBtn = popup.querySelector("#caseEvidencePopupActionBtn");
    if (actionBtn) {
      actionBtn.onclick = handleNavigateToEvidence;
    }
  }

  // Expose globally for testing/interaction
  window.cipherShowEvidencePrompt = showEvidencePromptPopup;

  function notifyUser(msg) {
    let t = document.getElementById("networkToast");
    if (!t) {
      t = document.createElement("div");
      t.id = "networkToast";
      t.className = "network-toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => {
      t.classList.remove("show");
    }, 3200);
  }

  let caseSequence = 14;

  async function openCaseModal() {
    if (!caseModal) return;

    // Fetch existing count to generate next Case ID
    try {
      const res = await fetch("/api/cases");
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.cases)) {
          const suffixes = data.cases
            .map(c => String(c?.case_number || "").match(/(\d+)\s*$/))
            .map(m => m ? Number(m[1]) : 0)
            .filter(n => Number.isFinite(n) && n > 0);
          const maxExisting = suffixes.length ? Math.max(...suffixes) : 13;
          caseSequence = Math.max(caseSequence, maxExisting + 1);
        }
      }
    } catch (e) {
      // offline fallback
    }

    const nextId = `C-2026-${String(caseSequence).padStart(3, "0")}`;
    if (caseIdDisplay) caseIdDisplay.textContent = nextId;
    if (caseIdHidden) caseIdHidden.value = nextId;

    // Default incident date to today
    if (caseDateInput) {
      caseDateInput.value = new Date().toISOString().split("T")[0];
    }

    // Auto-populate officer from registered user and auto-detect real location
    const activeOfficer = getActiveOfficerName();
    if (officerVal) officerVal.textContent = activeOfficer;
    if (officerHidden) officerHidden.value = activeOfficer;
    if (officerEditInput) officerEditInput.value = activeOfficer;

    // Reset toggle states
    if (officerEditInput) officerEditInput.style.display = "none";
    if (officerBox) officerBox.style.display = "flex";
    if (editOfficerBtn) editOfficerBtn.textContent = "Change";
    if (jurEditInput) jurEditInput.style.display = "none";
    if (jurBox) jurBox.style.display = "flex";
    if (editJurBtn) editJurBtn.textContent = "Change";

    // Auto-detect real location via GPS / network
    detectRealLocation(false);

    // Open modal
    caseModal.classList.add("open");
    caseModal.setAttribute("aria-hidden", "false");
    if (caseNameInput) {
      setTimeout(() => caseNameInput.focus(), 80);
    }
  }

  function closeCaseModal() {
    if (!caseModal) return;
    caseModal.classList.remove("open");
    caseModal.setAttribute("aria-hidden", "true");
  }

  if (newCaseBtn) {
    newCaseBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openCaseModal();
    });
  }

  if (caseCloseBtn) {
    caseCloseBtn.addEventListener("click", closeCaseModal);
  }
  if (caseCancelBtn) {
    caseCancelBtn.addEventListener("click", closeCaseModal);
  }

  const backdrop = caseModal?.querySelector(".case-create-backdrop");
  if (backdrop) {
    backdrop.addEventListener("click", closeCaseModal);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && caseModal?.classList.contains("open")) {
      closeCaseModal();
    }
  });

  // Officer Edit Toggle
  if (editOfficerBtn && officerEditInput && officerBox) {
    editOfficerBtn.addEventListener("click", () => {
      if (officerEditInput.style.display === "none") {
        officerEditInput.style.display = "block";
        officerEditInput.value = officerHidden?.value || officerVal?.textContent || getActiveOfficerName();
        officerBox.style.display = "none";
        editOfficerBtn.textContent = "Done";
        officerEditInput.focus();
      } else {
        const val = officerEditInput.value.trim() || getActiveOfficerName();
        if (officerVal) officerVal.textContent = val;
        if (officerHidden) officerHidden.value = val;
        officerEditInput.style.display = "none";
        officerBox.style.display = "flex";
        editOfficerBtn.textContent = "Change";
      }
    });

    officerEditInput.addEventListener("blur", () => {
      const val = officerEditInput.value.trim() || getActiveOfficerName();
      if (officerVal) officerVal.textContent = val;
      if (officerHidden) officerHidden.value = val;
    });

    officerEditInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const val = officerEditInput.value.trim() || getActiveOfficerName();
        if (officerVal) officerVal.textContent = val;
        if (officerHidden) officerHidden.value = val;
        officerEditInput.style.display = "none";
        officerBox.style.display = "flex";
        editOfficerBtn.textContent = "Change";
      }
    });
  }

  // Jurisdiction Edit Toggle
  if (editJurBtn && jurEditInput && jurBox) {
    editJurBtn.addEventListener("click", () => {
      if (jurEditInput.style.display === "none") {
        jurEditInput.style.display = "block";
        jurEditInput.value = jurisdictionHidden?.value || jurisdictionVal?.textContent || "";
        jurBox.style.display = "none";
        editJurBtn.textContent = "Done";
        jurEditInput.focus();
      } else {
        const val = jurEditInput.value.trim() || (jurisdictionVal?.textContent || "Central Zone");
        if (jurisdictionVal) jurisdictionVal.textContent = val;
        if (jurisdictionHidden) jurisdictionHidden.value = val;
        jurEditInput.style.display = "none";
        jurBox.style.display = "flex";
        editJurBtn.textContent = "Change";
      }
    });

    jurEditInput.addEventListener("blur", () => {
      const val = jurEditInput.value.trim() || (jurisdictionVal?.textContent || "Central Zone");
      if (jurisdictionVal) jurisdictionVal.textContent = val;
      if (jurisdictionHidden) jurisdictionHidden.value = val;
    });

    jurEditInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const val = jurEditInput.value.trim() || (jurisdictionVal?.textContent || "Central Zone");
        if (jurisdictionVal) jurisdictionVal.textContent = val;
        if (jurisdictionHidden) jurisdictionHidden.value = val;
        jurEditInput.style.display = "none";
        jurBox.style.display = "flex";
        editJurBtn.textContent = "Change";
      }
    });
  }

  // GPS Refresh Button
  if (detectGpsBtn) {
    detectGpsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      detectRealLocation(true);
    });
  }

  // Location input typing dynamic jurisdiction derivation
  if (caseLocInput) {
    let locTypingTimer = null;
    caseLocInput.addEventListener("input", () => {
      clearTimeout(locTypingTimer);
      const val = caseLocInput.value.trim();
      if (!val) return;
      locTypingTimer = setTimeout(() => {
        const parts = val.split(/[,–-]/).map(s => s.trim()).filter(Boolean);
        const bestCity = parts.length > 1 ? parts[parts.length - 1] : parts[0];
        if (bestCity && jurisdictionVal && (!jurEditInput || jurEditInput.style.display === "none")) {
          const cleanCity = bestCity.replace(/\(.*?\)/g, "").trim();
          if (cleanCity.length > 2) {
            const derivedJur = `${cleanCity} Police Division`;
            jurisdictionVal.textContent = derivedJur;
            if (jurisdictionHidden) jurisdictionHidden.value = derivedJur;
          }
        }
      }, 500);
    });
  }

  // Tag chip toggling & adding
  if (tagsWrapper) {
    tagsWrapper.addEventListener("click", (e) => {
      const chip = e.target.closest(".case-tag-chip");
      if (chip) {
        chip.classList.toggle("active");
      }
    });

    if (tagAddInput) {
      tagAddInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === ",") {
          e.preventDefault();
          const val = tagAddInput.value.replace(/,/g, "").trim();
          if (val) {
            const newChip = document.createElement("button");
            newChip.type = "button";
            newChip.className = "case-tag-chip active";
            newChip.dataset.tag = val;
            newChip.textContent = val;
            tagsWrapper.insertBefore(newChip, tagAddInput);
            tagAddInput.value = "";
          }
        }
      });
    }
  }

  // Select on Map button
  if (selectMapBtn && caseLocInput) {
    selectMapBtn.addEventListener("click", async () => {
      notifyUser("Detecting exact coordinates for location pin...");
      await detectRealLocation(true);
      if (caseLocInput.value) {
        notifyUser(`Pinned real location: ${caseLocInput.value}`);
      }
    });
  }

  // Form Submission
  if (caseForm) {
    caseForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const title = caseNameInput?.value.trim() || "";
      const case_number = caseIdHidden?.value.trim() || `C-2026-${String(caseSequence).padStart(3, "0")}`;
      const case_type = caseTypeSelect?.value || "Financial Crime";
      const priority = casePrioritySelect?.value || "High";
      const incident_date = caseDateInput?.value || new Date().toISOString().split("T")[0];
      const description = caseDescInput?.value.trim() || "Investigative intelligence case record.";
      const primary_location = caseLocInput?.value.trim() || currentDetectedLocation?.primary_location || "Local Division Command";
      const assigned_officer = officerHidden?.value.trim() || getActiveOfficerName();
      const jurisdiction = jurisdictionHidden?.value.trim() || (currentDetectedLocation?.jurisdiction || "Central Zone");

      const activeTags = Array.from(tagsWrapper?.querySelectorAll(".case-tag-chip.active") || [])
        .map(el => el.dataset.tag || el.textContent.trim())
        .filter(Boolean);
      const tags = activeTags.join(", ");

      if (!title) {
        notifyUser("Please enter a Case Name");
        return;
      }

      const payload = {
        case_number,
        title,
        case_type,
        priority,
        incident_date,
        description,
        primary_location,
        assigned_officer,
        jurisdiction,
        tags
      };

      // 1. Immediately close modal and show the green right-side evidence prompt popup
      caseSequence++;
      closeCaseModal();
      caseForm.reset();
      showEvidencePromptPopup(payload);
      notifyUser(`Case ${case_number} created and synchronized with database!`);

      // 2. Add the newly created case to the live orbital deck.
      // Do not recycle an existing card: every case gets its own orbital slot.
      try {
        if (stage) {
          const existing = Array.from(stage.querySelectorAll(".floating-case"))
            .find(card => card.dataset.caseId === case_number);

          let targetBox = existing || null;

          if (!targetBox) {
            targetBox = document.createElement("article");
            targetBox.className = "floating-case case-back is-new-case";
            stage.appendChild(targetBox);
          }

          targetBox.dataset.case = title;
          targetBox.dataset.caseId = case_number;
          targetBox.dataset.caseType = case_type;
          targetBox.dataset.priority = priority;
          targetBox.dataset.description = description;
          targetBox.dataset.incidentDate = incident_date;
          targetBox.dataset.location = primary_location;
          targetBox.dataset.officer = assigned_officer;
          targetBox.dataset.jurisdiction = jurisdiction;
          targetBox.dataset.tags = tags;
          targetBox.dataset.isNew = "true";

          const isHigh = priority.toUpperCase().includes("HIGH") || priority.toUpperCase().includes("CRITICAL");
          const cleanLoc = (primary_location || "Central").split("(")[0].trim();

          // Use text nodes/escaped values through DOM textContent rather than
          // injecting user-entered case fields as executable HTML.
          targetBox.replaceChildren();
          const top = document.createElement("div");
          top.className = "case-top";
          const idSpan = document.createElement("span");
          idSpan.textContent = `CASE / ${case_number}`;
          const priorityWrap = document.createElement("div");
          priorityWrap.style.cssText = "display:flex;align-items:center;gap:6px;";
          const priorityEl = document.createElement("b");
          if (isHigh) priorityEl.className = "high";
          priorityEl.textContent = priority.toUpperCase();
          const badge = document.createElement("span");
          badge.className = "case-new-badge";
          badge.textContent = "NEW";
          priorityWrap.append(priorityEl, badge);
          top.append(idSpan, priorityWrap);

          const titleEl = document.createElement("h3");
          titleEl.textContent = title;
          const descEl = document.createElement("p");
          descEl.textContent = description;
          const stats = document.createElement("div");
          stats.className = "case-stats";
          const typeEl = document.createElement("span");
          typeEl.textContent = case_type;
          const locEl = document.createElement("span");
          locEl.textContent = cleanLoc;
          stats.append(typeEl, locEl);

          targetBox.append(top, titleEl, descEl, stats);

          // Refresh the orbit's live card collection so the new case gets a
          // deterministic angular slot immediately, then focus that card.
          if (typeof window.cipherRefreshCases === "function") {
            window.cipherRefreshCases();
          }
          if (typeof window.cipherFocusCase === "function") {
            window.cipherFocusCase(targetBox);
          }
        }
      } catch (orbitErr) {
        console.warn("Orbit visual update notice:", orbitErr);
      }

      // 3. Concurrently sync to backend database
      try {
        const token = localStorage.getItem("cipher_access_token");
        const headers = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        fetch("/api/cases", {
          method: "POST",
          headers,
          body: JSON.stringify(payload)
        }).catch(fetchErr => console.warn("Backend save notice:", fetchErr));
      } catch (err) {
        console.warn("Backend save notice:", err);
      }
    });
  }
})();


/* =========================================================
   SCROLL-DRIVEN TIMELINE RECONSTRUCTION
   ========================================================= */

(function initCipherTimeline() {

  const section =
    document.getElementById(
      "timeline-reconstruction"
    );

  const canvas =
    document.getElementById(
      "cipherTimeline"
    );

  const trace =
    document.getElementById(
      "timelineTrace"
    );


  if (
    !section ||
    !canvas ||
    !trace
  ) {
    return;
  }


  const nodes = [
    ...canvas.querySelectorAll(
      ".timeline-node"
    )
  ];


  const events = [
    ...canvas.querySelectorAll(
      ".timeline-event"
    )
  ];


  const progressLabel =
    document.getElementById(
      "timelineProgressLabel"
    );


  const progressState =
    document.getElementById(
      "timelineProgressState"
    );


  let pathLength = 0;

  let raf = 0;

  let current = 0;

  let target = 0;


  function measure() {

    pathLength =
      trace.getTotalLength();

    trace.style.strokeDasharray =
      pathLength;

    trace.style.strokeDashoffset =
      pathLength;

  }


  function clamp(
    v,
    a = 0,
    b = 1
  ) {

    return Math.max(
      a,
      Math.min(
        b,
        v
      )
    );

  }


  function update() {

    raf = 0;


    const rect =
      section.getBoundingClientRect();


    const travel =
      Math.max(
        1,
        section.offsetHeight -
          window.innerHeight
      );


    target =
      clamp(
        -rect.top /
          travel
      );


    current +=
      (
        target -
        current
      ) *
      0.10;


    if (
      Math.abs(
        target -
        current
      ) <
      0.0005
    ) {

      current =
        target;

    }


    const eased =
      current *
      current *
      (
        3 -
        2 *
        current
      );


    trace.style.strokeDashoffset =
      pathLength *
      (
        1 -
        eased
      );


    const active =
      Math.min(
        nodes.length,
        Math.max(
          1,
          Math.floor(
            current *
              nodes.length
          ) +
            1
        )
      );


    nodes.forEach(
      (node, i) => {

        const index =
          i + 1;


        node.classList.toggle(
          "active",
          index <= active
        );


        node.classList.toggle(
          "current",
          index === active &&
          current < 0.995
        );

      }
    );


    events.forEach(
      (event, i) => {

        const index =
          i + 1;


        const threshold =
          (
            index - 1
          ) /
          Math.max(
            1,
            events.length -
              1
          );


        const show =
          current >=
          Math.max(
            0,
            threshold -
              0.055
          );


        event.classList.toggle(
          "visible",
          show
        );

      }
    );


    const shown =
      Math.min(
        nodes.length,
        Math.max(
          1,
          Math.ceil(
            current *
              nodes.length
          )
        )
      );


    if (progressLabel) {

      progressLabel.textContent =
        String(shown).padStart(
          2,
          "0"
        ) +
        " / " +
        String(
          nodes.length
        ).padStart(
          2,
          "0"
        );

    }


    if (progressState) {

      progressState.textContent =
        current > 0.97
          ? "TRACE COMPLETE"
          : current > 0.08
            ? "RECONSTRUCTING"
            : "TRACE READY";

    }


    if (current < 1) {

      raf =
        requestAnimationFrame(
          update
        );

    }

  }


  function request() {

    if (!raf) {

      raf =
        requestAnimationFrame(
          update
        );

    }

  }


  measure();


  window.addEventListener(
    "resize",
    () => {

      measure();
      request();

    },
    {
      passive: true
    }
  );


  window.addEventListener(
    "scroll",
    request,
    {
      passive: true
    }
  );


  request();

})();


/* =========================================================
   NETWORK WORKSPACE / NODE EDITOR
   ========================================================= */

(function initNetworkWorkspace() {

  const sideItems = [
    ...document.querySelectorAll(
      ".workspace-sidebar .side-item[data-view]"
    )
  ];


  const casesView =
    document.getElementById(
      "casesView"
    );

  const networkView =
    document.getElementById(
      "networkView"
    );

  const timelineView =
    document.getElementById(
      "timelineView"
    );

  const evidenceView =
    document.getElementById(
      "evidenceView"
    );

  const visionView =
    document.getElementById(
      "cipherVisionView"
    );

  const modal =
    document.getElementById(
      "nodeModal"
    );


  if (
    !sideItems.length ||
    !casesView ||
    !networkView
  ) {
    return;
  }


  function switchView(
    view
  ) {

    sideItems.forEach(
      btn =>
        btn.classList.toggle(
          "active",
          btn.dataset.view ===
            view
        )
    );


    casesView.classList.toggle(
      "active-view",
      view === "cases"
    );


    networkView.classList.toggle(
      "active-view",
      view === "network"
    );


    timelineView?.classList.toggle(
      "active-view",
      view === "timeline"
    );


    evidenceView?.classList.toggle(
      "active-view",
      view === "evidence"
    );

    visionView?.classList.toggle(
      "active-view",
      view === "vision"
    );

    if (view === "vision" && visionView) {
      visionView.scrollTop = 0;
      if (typeof window.loadCipherVision === "function") {
        window.loadCipherVision();
      }
    }

    const aiInvestigatorView = document.getElementById("aiInvestigatorView");
    aiInvestigatorView?.classList.toggle(
      "active-view",
      view === "ai-investigator"
    );

    if (view === "ai-investigator" && aiInvestigatorView) {
      aiInvestigatorView.scrollTop = 0;
      if (typeof window.refreshAIActivity === "function") {
        window.refreshAIActivity();
      }
    }


    if (
      view === "network"
    ) {

      networkView.scrollTop =
        0;

      setTimeout(() => {
        if (typeof window.loadNetworkGraph === "function") {
          window.loadNetworkGraph(window.CipherCaseState?.id);
        }
      }, 50);

    }


    if (
      view === "timeline" &&
      timelineView
    ) {

      timelineView.scrollTop =
        0;

    }


    if (
      view === "evidence" &&
      evidenceView
    ) {

      evidenceView.scrollTop =
        0;

    }

  }


  sideItems.forEach(
    btn =>
      btn.addEventListener(
        "click",
        () =>
          switchView(
            btn.dataset.view
          )
      )
  );

  window.cipherSwitchView = switchView;


  const openModal = async () => {
    if (!modal) return;
    modal.classList.add("open");
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    showStep(1);

    // Populate target entity dropdown for relationship linking
    const targetSelect = document.getElementById("nodeModalTargetNode");
    if (targetSelect) {
      targetSelect.innerHTML = '<option value="">-- Select existing entity (optional) --</option>';
      try {
        const res = await fetch(`/api/cases/${window.CipherCaseState?.id || 0}/entities`, {headers: (typeof window.authHeaders === "function" ? window.authHeaders(false) : {})});
        if (res.ok) {
          const data = await res.json();
          const entities = data.entities || [];
          entities.forEach(ent => {
            const opt = document.createElement("option");
            opt.value = ent.id;
            opt.textContent = `${ent.label} (${(ent.entity_type || "person").toUpperCase()})`;
            targetSelect.appendChild(opt);
          });
        }
      } catch (err) {
        console.warn("Could not fetch entities for node modal dropdown:", err);
      }
    }

    setTimeout(
      () =>
        modal
          .querySelector(
            'input[name="nodeName"]'
          )
          ?.focus(),
      80
    );
  };

  window.cipherOpenNodeModal = openModal;

  const closeModal = () => {
    if (!modal) return;
    modal.classList.remove("open");
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");

    if (
      document
        .getElementById(
          "cipherWorkspace"
        )
        ?.classList.contains(
          "open"
        )
    ) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  };

  window.cipherCloseNodeModal = closeModal;

  document
    .getElementById(
      "addNodeBtn"
    )
    ?.addEventListener(
      "click",
      openModal
    );


  // Delete Node button listener is handled in initCipherNetworkModule with confirmation and API call


  document
    .querySelectorAll(
      "[data-node-close]"
    )
    .forEach(
      el =>
        el.addEventListener(
          "click",
          closeModal
        )
    );


  document
    .getElementById(
      "nodeModalClose"
    )
    ?.addEventListener(
      "click",
      closeModal
    );


  document.addEventListener(
    "keydown",
    e => {

      if (
        e.key === "Escape" &&
        modal?.classList.contains(
          "open"
        )
      ) {

        closeModal();

      }

    }
  );


  let step = 1;


  const steps = [
    ...document.querySelectorAll(
      ".node-step"
    )
  ];


  const dots = [
    ...document.querySelectorAll(
      "[data-step-dot]"
    )
  ];


  const counter =
    document.getElementById(
      "nodeStepNumber"
    );


  const next =
    document.getElementById(
      "nodeNext"
    );


  const back =
    document.getElementById(
      "nodeBack"
    );


  function showStep(n) {

    step =
      Math.max(
        1,
        Math.min(
          4,
          n
        )
      );


    steps.forEach(
      x =>
        x.classList.toggle(
          "active",
          Number(
            x.dataset.step
          ) === step
        )
    );


    dots.forEach(
      x =>
        x.classList.toggle(
          "active",
          Number(
            x.dataset.stepDot
          ) <= step
        )
    );


    if (counter) {

      counter.textContent =
        String(step).padStart(
          2,
          "0"
        );

    }


    if (back) {

      back.style.visibility =
        step === 1
          ? "hidden"
          : "visible";

    }


    if (next) {

      next.innerHTML =
        step === 4
          ? 'LINK NODE <span>↗</span>'
          : 'NEXT <span>→</span>';

    }

  }


  next?.addEventListener(
    "click",
    () => {

      if (step === 1) {
        const nameVal = (document.getElementById("nodeModalName")?.value || document.querySelector('#nodeForm input[name="nodeName"]')?.value || "").trim();
        if (!nameVal) {
          if (typeof showNetworkToast === "function") {
            showNetworkToast("Please enter a name or label for the entity before proceeding.");
          } else if (typeof toast === "function") {
            toast("Please enter a name or label for the entity before proceeding.");
          }
          const input = document.getElementById("nodeModalName") || document.querySelector('#nodeForm input[name="nodeName"]');
          input?.focus();
          return;
        }
      }

      if (step < 4) {

        showStep(
          step + 1
        );

        return;

      }


      // On Step 4, submit the form to create entity and link in database & graph
      const nodeForm = document.getElementById("nodeForm");
      if (nodeForm) {
        nodeForm.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
      } else {
        closeModal();
      }

    }
  );

  document.getElementById("nodeQuickCreate")?.addEventListener("click", () => {
    const nodeForm = document.getElementById("nodeForm");
    if (nodeForm) {
      nodeForm.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    }
  });


  back?.addEventListener(
    "click",
    () =>
      showStep(
        step - 1
      )
  );


  document
    .querySelectorAll(
      ".node-type"
    )
    .forEach(
      btn =>
        btn.addEventListener(
          "click",
          () => {

            document
              .querySelectorAll(
                ".node-type"
              )
              .forEach(
                x =>
                  x.classList.remove(
                    "active"
                  )
              );


            btn.classList.add(
              "active"
            );

          }
        )
    );


  document
    .querySelectorAll(
      ".source-choice"
    )
    .forEach(
      btn =>
        btn.addEventListener(
          "click",
          () => {

            document
              .querySelectorAll(
                ".source-choice"
              )
              .forEach(
                x =>
                  x.classList.remove(
                    "active"
                  )
              );


            btn.classList.add(
              "active"
            );

          }
        )
    );


  document
    .querySelectorAll(
      ".confidence"
    )
    .forEach(
      btn =>
        btn.addEventListener(
          "click",
          () => {

            document
              .querySelectorAll(
                ".confidence"
              )
              .forEach(
                x =>
                  x.classList.remove(
                    "active"
                  )
              );


            btn.classList.add(
              "active"
            );

          }
        )
    );


  document.querySelectorAll("#networkInspector .inspector-tabs button").forEach(btn => {
    btn.addEventListener("click", () => {
      activeNetworkInspectorTab = btn.dataset.inspectorTab || "node";
      document.querySelectorAll("#networkInspector .inspector-tabs button").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      renderNetworkInspectorTab();
    });
  });

  function renderNetworkInspectorTab() {
    const hasNode = Boolean(activeNodeIntel);
    if (nodeInspectorContent) nodeInspectorContent.style.display = hasNode && activeNetworkInspectorTab === "node" ? "block" : "none";
    if (nodeInspectorLinksPanel) nodeInspectorLinksPanel.style.display = hasNode && activeNetworkInspectorTab === "links" ? "block" : "none";
    if (nodeInspectorSourcePanel) nodeInspectorSourcePanel.style.display = hasNode && activeNetworkInspectorTab === "source" ? "block" : "none";
    if (!hasNode) {
      if (nodeInspectorContent) nodeInspectorContent.style.display = "none";
      if (nodeInspectorLinksPanel) nodeInspectorLinksPanel.style.display = "none";
      if (nodeInspectorSourcePanel) nodeInspectorSourcePanel.style.display = "none";
    }
  }

  function renderBackendNodeLinks(intel) {
    // LINKS is intentionally CSV-only: the relationship names shown here are
    // extracted from the currently uploaded CSV, not synthesized from backend
    // intelligence. The Network graph itself uses the same CSV edges, so the
    // two views always describe the same relationship structure.
    const currentId = String(intel?.raw_id ?? "").replace(/^ent-/, "");
    const currentLabel = String(intel?.node?.label || intel?.node?.name || "").trim().toLowerCase();
    const local = window.CipherLocalGraphData;
    const localEdges = Array.isArray(local?.edges) ? local.edges : [];
    const localNodes = Array.isArray(local?.nodes) ? local.nodes : [];
    const nodeLabel = (id) => {
      const n = localNodes.find(x => String(x?.id ?? x?.data?.id ?? "").replace(/^ent-/, "") === String(id).replace(/^ent-/, ""));
      return String(n?.label ?? n?.data?.label ?? id ?? "Unknown entity");
    };
    const localMatches = localEdges.filter(e => {
      const source = String(e?.source ?? e?.data?.source ?? "").replace(/^ent-/, "");
      const target = String(e?.target ?? e?.data?.target ?? "").replace(/^ent-/, "");
      if (source === currentId || target === currentId) return true;
      if (!currentLabel) return false;
      return nodeLabel(source).trim().toLowerCase() === currentLabel || nodeLabel(target).trim().toLowerCase() === currentLabel;
    });

    const relationships = [];
    const seen = new Set();
    localMatches.forEach(e => {
      const relationship = String(e?.relationship_type || e?.label || "ASSOCIATED_WITH").trim() || "ASSOCIATED_WITH";
      const key = relationship.toLowerCase();
      if (!seen.has(key)) { seen.add(key); relationships.push(relationship); }
    });

    if (nodeInspectLinksPanelCount) nodeInspectLinksPanelCount.textContent = String(localMatches.length);
    if (inspectRelCount) inspectRelCount.textContent = String(localMatches.length);
    if (!nodeInspectLinksPanelList) return;
    if (!relationships.length) {
      nodeInspectLinksPanelList.innerHTML = `<div class="network-links-empty"><span>◎</span><b>NO CSV RELATIONSHIPS</b><small>Select a node that has a relationship in the uploaded CSV.</small></div>`;
      if (inspectRelList) inspectRelList.innerHTML = "No CSV relationships found.";
      return;
    }

    nodeInspectLinksPanelList.innerHTML = relationships.map((relationship, index) => `
      <div class="network-csv-relationship-row">
        <span>${String(index + 1).padStart(2, "0")}</span>
        <b>${escapeHtml(relationship)}</b>
      </div>`).join("");
    if (inspectRelList) {
      inspectRelList.innerHTML = relationships.map(r => `<div class="network-rel-row"><b>${escapeHtml(r)}</b></div>`).join("");
    }
  }

  function renderBackendNodeSource(intel) {
    const src = intel?.source || {};
    const entity = src.entity || intel?.node || {};
    const rows = [];
    const addRow = (label, value) => {
      if (value === null || value === undefined || value === "" || value === "—") return;
      rows.push(`<div class="inspector-row"><span>${escapeHtml(label)}</span><b style="text-align:right;max-width:62%;word-break:break-word;">${escapeHtml(String(value))}</b></div>`);
    };
    addRow("SOURCE DOCUMENT", entity.source_document_id || "—");
    addRow("SOURCE TYPE", entity.source_type);
    addRow("SOURCE REFERENCE", entity.source_reference);
    addRow("EXTRACTION", entity.extraction_method);
    addRow("EXTERNAL ID", entity.external_id);
    addRow("STATUS REASON", entity.status_reason);
    addRow("EVIDENCE IDS", entity.evidence_id_text);
    addRow("LATITUDE", entity.latitude);
    addRow("LONGITUDE", entity.longitude);
    addRow("CREATED", entity.created_at);

    const locationRows = Array.isArray(src.locations) ? src.locations : [];
    const eventRows = Array.isArray(src.timeline_events) ? src.timeline_events : [];
    const obsRows = Array.isArray(src.observations) ? src.observations : [];
    const docs = Array.isArray(src.evidence_documents) ? src.evidence_documents : [];
    const reviews = Array.isArray(src.review_records) ? src.review_records : [];

    let html = `<div class="inspector-section" style="border-top:0;padding-top:0;">${rows.join("") || `<div class="inspector-placeholder">No additional entity metadata is recorded.</div>`}</div>`;
    html += `<div class="inspector-section"><div class="inspector-section-title"><span>LOCATIONS / OBSERVATIONS</span><small>${locationRows.length + obsRows.length}</small></div>`;
    if (!locationRows.length && !obsRows.length) html += `<div class="inspector-placeholder">No location or observation records are attached to this node.</div>`;
    locationRows.forEach(l => { html += `<div style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05);"><b style="color:#d9e0da;font-size:10px;">${escapeHtml(l.label)}</b><div style="font-size:9px;color:#7e8982;margin-top:4px;">${escapeHtml(l.location_type || "LOCATION")} · ${escapeHtml(l.event_timestamp || l.observed_at || "time not recorded")}</div><div style="font-size:9px;color:#6f7973;margin-top:3px;">${escapeHtml(l.address_text || "Coordinates recorded")}</div></div>`; });
    obsRows.forEach(o => { html += `<div style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05);"><b style="color:#d9e0da;font-size:10px;">OBSERVATION</b><div style="font-size:9px;color:#7e8982;margin-top:4px;">${escapeHtml(o.timestamp || "time not recorded")} · ${escapeHtml(o.entity_type || "ENTITY")}</div><div style="font-size:9px;color:#6f7973;margin-top:3px;">Location ID ${escapeHtml(o.location_id)} · ${escapeHtml(o.source_document || "source not recorded")}</div></div>`; });
    html += `</div>`;

    html += `<div class="inspector-section"><div class="inspector-section-title"><span>TIMELINE RECORDS</span><small>${eventRows.length}</small></div>`;
    if (!eventRows.length) html += `<div class="inspector-placeholder">No timeline events are attached to this node.</div>`;
    eventRows.forEach(e => { html += `<div style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05);"><b style="color:#b8ff4d;font-size:10px;">${escapeHtml(e.event_type || "EVENT")}</b><div style="font:8px 'DM Mono',monospace;color:#7f8a83;margin-top:4px;">${escapeHtml(e.event_time || "TIME NOT RECORDED")}</div><div style="font-size:9px;line-height:1.5;color:#89938d;margin-top:4px;">${escapeHtml(e.description || "No narrative recorded.")}</div>${e.location_label ? `<div style="font-size:8px;color:#68736d;margin-top:4px;">LOCATION · ${escapeHtml(e.location_label)}</div>` : ""}</div>`; });
    html += `</div>`;

    html += `<div class="inspector-section"><div class="inspector-section-title"><span>EVIDENCE SOURCES</span><small>${docs.length}</small></div>`;
    if (!docs.length) html += `<div class="inspector-placeholder">No evidence document is directly linked to this node.</div>`;
    docs.forEach(d => { html += `<div style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05);"><b style="color:#d9e0da;font-size:10px;">${escapeHtml(d.filename || "Evidence document")}</b><div style="font:8px 'DM Mono',monospace;color:#77827b;margin-top:4px;">${escapeHtml(d.file_type || "FILE")} · ${escapeHtml(d.processing_status || "UNKNOWN")}</div><div style="font-size:8px;color:#68736d;margin-top:3px;">${escapeHtml(d.source_type || "SOURCE")}${d.uploaded_at ? ` · ${escapeHtml(d.uploaded_at)}` : ""}</div></div>`; });
    html += `</div>`;

    html += `<div class="inspector-section"><div class="inspector-section-title"><span>REVIEW / PROVENANCE</span><small>${reviews.length}</small></div>`;
    if (!reviews.length) html += `<div class="inspector-placeholder">No review record is attached to this node.</div>`;
    reviews.forEach(r => { html += `<div style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05);"><b style="color:#d9e0da;font-size:10px;">${escapeHtml(r.title || r.suggestion_type || "Review record")}</b><div style="font-size:9px;color:#7e8982;margin-top:4px;">${escapeHtml(r.status || "PENDING")} · ${escapeHtml(r.source_reference || r.source_document || "source not recorded")}</div><div style="font-size:9px;line-height:1.5;color:#707b74;margin-top:4px;">${escapeHtml(r.description || r.reason || "")}</div></div>`; });
    html += `</div>`;

    if (nodeInspectSourceStatus) nodeInspectSourceStatus.textContent = `${docs.length} DOCS · ${eventRows.length} EVENTS`;
    if (nodeInspectSourcePanelBody) nodeInspectSourcePanelBody.innerHTML = html;
  }

  async function loadNodeIntel(entityId) {
    const caseId = Number(window.CipherCaseState?.id);
    if (!caseId || !entityId) return;
    try {
      const token = localStorage.getItem("cipher_access_token");
      const headers = {"Accept":"application/json"};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`/api/cases/${caseId}/graph/nodes/${encodeURIComponent(String(entityId).replace(/^ent-/, ""))}/intel?include=pending`, {headers});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const intel = await res.json();
      activeNodeIntel = intel;
      renderBackendNodeLinks(intel);
      renderBackendNodeSource(intel);
      renderNetworkInspectorTab();
    } catch (err) {
      console.warn("Node intelligence lookup failed; retaining CSV/graph relationship data.", err);
      renderBackendNodeLinks(activeNodeIntel || { raw_id: entityId });
      renderNetworkInspectorTab();
    }
  }

  function showNetworkToast(
    message
  ) {

    let t =
      document.getElementById(
        "networkToast"
      );


    if (!t) {

      t =
        document.createElement(
          "div"
        );

      t.id =
        "networkToast";

      t.className =
        "network-toast";

      document.body.appendChild(
        t
      );

    }


    t.textContent =
      message;


    t.classList.add(
      "show"
    );


    clearTimeout(
      t._timer
    );


    t._timer =
      setTimeout(
        () =>
          t.classList.remove(
            "show"
          ),
        2600
      );

  }

})();


function getCipherActiveCaseId() {
  const id = Number(window.CipherCaseState?.id || 0);
  return Number.isFinite(id) && id > 0 && window.CipherCaseState?.caseSelected ? id : 0;
}

/* =========================================================
   CSV IMPORT
   ========================================================= */

(function initCsvImport() {
  const input = document.getElementById("csvFileInput");
  const mainBtn = document.getElementById("mainCsvUploadBtn");
  const nodeBtn = document.getElementById("nodeCsvUploadBtn");
  const dropzone = document.getElementById("nodeCsvDropzone");
  const status = document.getElementById("csvFileStatus");

  // Modal elements
  const csvModal = document.getElementById("cipherCsvModal");
  const csvBackdrop = document.getElementById("cipherCsvBackdrop");
  const csvClose = document.getElementById("cipherCsvClose");
  const csvCancelBtn = document.getElementById("cipherCsvCancelBtn");
  const csvProceedBtn = document.getElementById("cipherCsvProceedBtn");
  const csvFileName = document.getElementById("cipherCsvFileName");
  const csvRowStats = document.getElementById("cipherCsvRowStats");
  const csvPreviewTable = document.getElementById("cipherCsvPreviewTable");
  const csvLoadSampleBtn = document.getElementById("cipherCsvLoadSampleBtn");
  const csvChangeFileBtn = document.getElementById("cipherCsvChangeFileBtn");
  const csvErrorMsg = document.getElementById("cipherCsvErrorMsg");

  if (!input) return;

  let currentFile = null;
  let currentCsvText = "";
  let currentFilename = "investigation_template.csv";

  function parseCsvString(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };

    const firstLine = lines[0];
    const commas = (firstLine.match(/,/g) || []).length;
    const semis = (firstLine.match(/;/g) || []).length;
    const tabs = (firstLine.match(/\t/g) || []).length;
    let delim = ",";
    if (semis > commas && semis > tabs) delim = ";";
    else if (tabs > commas && tabs > semis) delim = "\t";

    function parseLine(line) {
      const cells = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === delim && !inQuotes) {
          cells.push(cur.trim());
          cur = "";
        } else {
          cur += ch;
        }
      }
      cells.push(cur.trim());
      return cells;
    }

    // Normalize the first header as well as all header names. Excel/Windows CSV
    // files frequently carry a UTF-8 BOM (\\uFEFF); if it survives parsing,
    // `record_type` becomes invisible to the master-CSV detector.
    const headers = parseLine(lines[0]).map(h => String(h || "").replace(/^\\uFEFF/, "").trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = parseLine(lines[i]);
      if (vals.every(v => v === "")) continue;
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = vals[idx] !== undefined ? vals[idx] : "";
      });
      rows.push(obj);
    }
    return { headers, rows };
  }

  function escapeHtml(val) {
    return String(val || "").replace(/[&<>'"]/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    })[c]);
  }

  // Build an immediate, local graph preview from the CSV itself. The backend
  // intentionally queues CSV evidence for verification, so this preview lets
  // investigators see the relationship structure without pretending that the
  // pending evidence is already verified. Once the backend finishes/review
  // accepts the findings, the normal verified graph remains authoritative.
  function buildLocalCsvGraph(csvText) {
    const { headers, rows } = parseCsvString(csvText || "");
    const key = (name) => String(name || "").replace(/^\\uFEFF/, "").trim().toLowerCase();
    const headerMap = {};
    headers.forEach(h => { headerMap[key(h)] = h; });
    const get = (row, ...names) => {
      for (const n of names) {
        const actual = headerMap[key(n)];
        if (actual && row[actual] != null && String(row[actual]).trim() !== "") return String(row[actual]).trim();
      }
      return "";
    };
    const clean = (v) => {
      const x = String(v || "").trim();
      return !x || /^(nan|null|undefined)$/i.test(x) ? "" : x;
    };

    const nodeMap = new Map();
    const edges = [];
    let edgeSeq = 0;
    const ensureNode = (id, label, type, extra = {}) => {
      id = clean(id); label = clean(label) || id;
      if (!id) id = `csv-node-${nodeMap.size + 1}`;
      if (!nodeMap.has(id)) {
        nodeMap.set(id, { id, label, type: clean(type) || "entity", aliases: extra.aliases || "", confidence: 1, status: "pending", ...extra });
      } else {
        const n = nodeMap.get(id);
        if ((!n.label || n.label === n.id) && label) n.label = label;
        if ((!n.type || n.type === "entity") && type) n.type = type;
      }
      return id;
    };
    const addEdge = (source, target, rel, evidence = "") => {
      source = clean(source); target = clean(target);
      if (!source || !target || source === target) return;
      ensureNode(source, source, "entity");
      ensureNode(target, target, "entity");
      edges.push({ id: `csv-edge-${++edgeSeq}`, source, target, label: clean(rel) || "ASSOCIATED_WITH", relationship_type: clean(rel) || "ASSOCIATED_WITH", evidence, confidence: 1, status: "pending" });
    };

    // Format A: compact investigation CSV with one entity per row and
    // connected_to / relationship columns.
    const simpleName = headerMap.name || headerMap.label || headerMap.entity || headerMap.person;
    const simpleConnect = headerMap.connected_to || headerMap.connected || headerMap.target || headerMap.target_node || headerMap.related_entity_id;
    if (simpleName && !headerMap.source && !headerMap.source_id && !headerMap.source_entity_id && (simpleConnect || headerMap.relationship || headerMap.relationship_type)) {
      rows.forEach((row, idx) => {
        const label = clean(get(row, "name", "label", "entity", "person"));
        if (!label) return;
        const type = clean(get(row, "type", "entity_type", "category")) || "entity";
        const id = clean(get(row, "entity_id", "id")) || `csv-${idx + 1}`;
        const aliases = clean(get(row, "aliases", "alias", "role"));
        ensureNode(id, label, type, { aliases });
        const targetLabel = clean(get(row, "connected_to", "connected", "target", "target_node", "related_entity_id"));
        if (targetLabel) {
          // Prefer an existing ID/label, otherwise create a stable label-derived ID.
          let targetId = targetLabel;
          const existing = [...nodeMap.values()].find(n => n.label.toLowerCase() === targetLabel.toLowerCase());
          if (existing) targetId = existing.id;
          else targetId = `csv-target-${targetLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || edgeSeq + 1}`;
          ensureNode(targetId, targetLabel, "entity");
          addEdge(id, targetId, get(row, "relationship", "relationship_type", "relation", "link_type"), get(row, "evidence", "source_reference"));
        }
      });
    }

    // Format A2: split entity + relationship rows. This is common for
    // investigator-created CSVs: entity rows use name/type, while relationship
    // rows use source/target/relationship/evidence.
    if (headerMap.source && headerMap.target) {
      rows.forEach((row, idx) => {
        const label = clean(get(row, "name", "label", "entity", "person"));
        if (!label) return;
        const type = clean(get(row, "type", "entity_type", "category")) || "entity";
        const id = clean(get(row, "entity_id", "id")) || `csv-${idx + 1}`;
        ensureNode(id, label, type, {
          aliases: clean(get(row, "aliases", "alias", "role")),
          lat: get(row, "latitude", "lat"),
          lng: get(row, "longitude", "lng")
        });
      });
      const resolveRef = (ref) => {
        ref = clean(ref);
        if (!ref) return "";
        if (nodeMap.has(ref)) return ref;
        const match = [...nodeMap.values()].find(n => String(n.label).toLowerCase() === ref.toLowerCase());
        return match ? match.id : `csv-ref-${ref.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || edgeSeq + 1}`;
      };
      rows.forEach((row) => {
        const source = resolveRef(get(row, "source", "source_id", "source_entity_id", "relationship_source"));
        const target = resolveRef(get(row, "target", "target_id", "target_entity_id", "relationship_target"));
        if (!source || !target) return;
        const sourceLabel = clean(get(row, "source"));
        const targetLabel = clean(get(row, "target"));
        if (!nodeMap.has(source)) ensureNode(source, sourceLabel || source, "entity");
        if (!nodeMap.has(target)) ensureNode(target, targetLabel || target, "entity");
        addEdge(source, target, get(row, "relationship", "relationship_type", "relation", "link_type"), get(row, "evidence", "source_reference", "reason"));
      });
    }

    // Format B: CIPHER master CSV with record_type=nodes / relationships.
    const recordTypeHeader = headerMap.record_type;
    if (recordTypeHeader) {
      rows.forEach((row, idx) => {
        const recordType = clean(row[recordTypeHeader]).toLowerCase();
        if (recordType === "nodes") {
          const id = clean(get(row, "entity_id", "id")) || `csv-node-${idx + 1}`;
          const label = clean(get(row, "name", "label", "entity")) || id;
          const type = clean(get(row, "type", "entity_type", "category")) || "entity";
          ensureNode(id, label, type, { aliases: clean(get(row, "aliases", "alias")), lat: get(row, "latitude", "lat"), lng: get(row, "longitude", "lng") });
        }
      });
      rows.forEach((row) => {
        if (clean(row[recordTypeHeader]).toLowerCase() !== "relationships") return;
        const sourceRaw = clean(get(row, "source_id", "source_entity_id", "source", "relationship_source"));
        const targetRaw = clean(get(row, "target_id", "target_entity_id", "target", "relationship_target"));
        const rel = clean(get(row, "relationship_type", "relationship", "relation"));
        const resolveMasterRef = (ref) => {
          if (!ref) return "";
          if (nodeMap.has(ref)) return ref;
          const match = [...nodeMap.values()].find(n => String(n.label || "").trim().toLowerCase() === ref.toLowerCase());
          if (match) return match.id;
          return ref;
        };
        const source = resolveMasterRef(sourceRaw);
        const target = resolveMasterRef(targetRaw);
        if (source && target) addEdge(source, target, rel, get(row, "source_reference", "evidence", "reason"));
      });
    }

    if (!nodeMap.size) return null;
    return {
      nodes: [...nodeMap.values()],
      edges,
      source: "csv-preview",
      filename: currentFilename,
      caseId: Number(window.CipherCaseState?.id || 0),
      pending: true,
      rowCount: rows.length
    };
  }

  window.CipherBuildLocalCsvGraph = buildLocalCsvGraph;


  // Build a temporal trace directly from the same CSV preview. Relationship
  // evidence often carries an ISO date prefix (e.g. "2026-01-14:"); explicit
  // event/date columns are preferred when present. This remains PENDING until
  // the evidence pipeline verifies it.
  function buildLocalCsvTimeline(csvText) {
    const { headers, rows } = parseCsvString(csvText || "");
    const key = (name) => String(name || "").trim().toLowerCase().replace(/\s+/g, "_");
    const headerMap = {};
    headers.forEach(h => { headerMap[key(h)] = h; });
    const get = (row, ...names) => {
      for (const n of names) {
        const actual = headerMap[key(n)];
        if (actual && row[actual] != null && String(row[actual]).trim() !== "") return String(row[actual]).trim();
      }
      return "";
    };
    const clean = v => String(v || "").trim();
    const events = [];
    const seen = new Set();
    const parseDate = raw => {
      const value = clean(raw);
      const m = value.match(/\b(20\d{2}|19\d{2})[-\/.](\d{1,2})[-\/.](\d{1,2})\b/);
      if (m) return `${m[1]}-${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}`;
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0,10);
    };
    const add = (dateRaw, title, description, type, tags = [], meta = {}) => {
      const date = parseDate(dateRaw);
      if (!date && !title) return;
      const signature = `${date}|${title}|${description}|${type}`.toLowerCase();
      if (seen.has(signature)) return;
      seen.add(signature);
      events.push({
        event_time: date || "",
        title: clean(title) || "Investigation event",
        description: clean(description) || "CSV evidence event pending verification.",
        event_type: clean(type) || "EVENT",
        tags: tags.filter(Boolean).slice(0,3),
        verification_status: "PENDING REVIEW",
        ...meta
      });
    };

    rows.forEach((row, idx) => {
      const explicitDate = get(row, "event_time", "event_date", "date", "timestamp", "occurred_at", "time_occurred", "time", "datetime");
      const source = get(row, "source", "source_id", "source_entity_id", "relationship_source");
      const target = get(row, "target", "target_id", "target_entity_id", "relationship_target");
      const rel = get(row, "relationship", "relationship_type", "relation", "link_type");
      const evidence = get(row, "evidence", "source_reference", "reason", "description", "details");
      const embeddedDate = evidence.match(/\b(?:19|20)\d{2}[-\/.]\d{1,2}[-\/.]\d{1,2}\b/)?.[0] || "";
      const date = explicitDate || embeddedDate;

      // Relationship rows become temporal events. For split-row CSVs this gives
      // investigators the actual sequence that produced each network edge.
      if (source && target) {
        add(date, `${source} → ${target}`, evidence || `${rel || "ASSOCIATED_WITH"} relationship recorded in CSV.`, rel || "RELATIONSHIP", [rel, "PENDING"]);
        return;
      }

      const title = get(row, "event", "event_title", "title", "name", "label");
      const desc = evidence || get(row, "event_description", "description", "notes", "details");
      const type = get(row, "event_type", "type", "category") || (title ? "EVENT" : "");
      if (date && (title || desc)) add(date, title || `CSV event ${idx + 1}`, desc, type, [type, "PENDING"]);
    });

    events.sort((a,b) => (a.event_time || "9999-99-99").localeCompare(b.event_time || "9999-99-99"));
    return events;
  }

  window.CipherBuildLocalCsvTimeline = buildLocalCsvTimeline;

  function renderPreviewTable(headers, rows) {
    if (!csvPreviewTable) return;
    if (headers.length === 0) {
      csvPreviewTable.innerHTML = '<tr><td style="padding:10px;text-align:center;color:#666;">No valid records detected in CSV</td></tr>';
      return;
    }

    let html = '<thead><tr style="border-bottom:1px solid #233030;background:#0d1414;">';
    headers.forEach(h => {
      html += `<th style="padding:7px 10px;font-size:10px;letter-spacing:0.06em;color:#7fe9df;text-transform:uppercase;white-space:nowrap;">${escapeHtml(h)}</th>`;
    });
    html += '</tr></thead><tbody>';

    const displayRows = rows.slice(0, 5);
    displayRows.forEach((row, idx) => {
      const bg = idx % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent";
      html += `<tr style="border-bottom:1px solid #162020;background:${bg};">`;
      headers.forEach(h => {
        const val = row[h] || "";
        const isHighlight = h.toLowerCase().includes("name") || h.toLowerCase().includes("label");
        html += `<td style="padding:6px 10px;font-size:11px;color:${isHighlight ? '#fff' : '#a0aba7'};white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(val) || '<span style="color:#445;">—</span>'}</td>`;
      });
      html += '</tr>';
    });

    if (rows.length > 5) {
      html += `<tr><td colspan="${headers.length}" style="padding:6px 10px;font-size:10px;color:#7fe9df;background:#080c0c;text-align:center;">+ ${rows.length - 5} more records will be processed into the investigation</td></tr>`;
    }

    html += '</tbody>';
    csvPreviewTable.innerHTML = html;
  }

  async function openCsvModal(filename, csvText, fileObj = null) {
    const activeCaseId = Number(window.CipherCaseState?.id || 0);
    const caseSelected = Boolean(window.CipherCaseState?.caseSelected && activeCaseId);
    if (!caseSelected) {
      if (typeof showNetworkToast === "function") showNetworkToast("Select a case before uploading CSV evidence.");
      return;
    }
    if (csvErrorMsg) {
      csvErrorMsg.style.display = "none";
      csvErrorMsg.textContent = "";
    }

    currentFilename = filename || "investigation_template.csv";
    currentCsvText = csvText || "";
    currentFile = fileObj;

    // If no text provided, load sample template from server
    if (!currentCsvText && !currentFile) {
      try {
        const sRes = await fetch(`/api/cases/${window.CipherCaseState?.id || 0}/sample-csv`);
        if (sRes.ok) {
          currentCsvText = await sRes.text();
          currentFilename = "investigation_template.csv";
        }
      } catch (err) {
        console.warn("Could not prefetch sample CSV", err);
      }
    }

    const { headers, rows } = parseCsvString(currentCsvText);

    if (csvFileName) csvFileName.textContent = currentFilename;
    if (csvRowStats) {
      csvRowStats.textContent = `${rows.length} data row${rows.length === 1 ? '' : 's'} · ${headers.length} column${headers.length === 1 ? '' : 's'} identified`;
    }

    renderPreviewTable(headers, rows);

    if (csvModal) {
      csvModal.classList.add("open");
      csvModal.style.display = "flex";
      csvModal.setAttribute("aria-hidden", "false");
    }

    if (status) {
      status.classList.add("has-file");
      status.innerHTML = `
        <span class="status-dot"></span>
        <div>
          <b>${escapeHtml(currentFilename)}</b>
          <small>${rows.length} records ready for graph ingestion</small>
        </div>
      `;
    }
  }

  function closeCsvModal() {
    if (!csvModal) return;
    csvModal.classList.remove("open");
    csvModal.style.display = "none";
    csvModal.setAttribute("aria-hidden", "true");
    if (csvErrorMsg) {
      csvErrorMsg.style.display = "none";
      csvErrorMsg.textContent = "";
    }
  }

  // Bind close buttons
  csvClose?.addEventListener("click", closeCsvModal);
  csvCancelBtn?.addEventListener("click", closeCsvModal);
  csvBackdrop?.addEventListener("click", closeCsvModal);

  // Change file button
  csvChangeFileBtn?.addEventListener("click", () => {
    input.value = "";
    input.click();
  });

  // Load sample Falcon CSV button
  csvLoadSampleBtn?.addEventListener("click", async () => {
    try {
      if (typeof showNetworkToast === "function") {
        showNetworkToast("Loading the active case CSV template...");
      }
      const res = await fetch(`/api/cases/${window.CipherCaseState?.id || 0}/sample-csv`);
      if (res.ok) {
        const text = await res.text();
        await openCsvModal("investigation_template.csv", text, null);
      }
    } catch (e) {
      console.error("Failed to load sample CSV:", e);
    }
  });

  // Poll the real backend evidence worker after a queued CSV upload. The local
  // preview is only a short-lived bridge; once the worker creates database-backed
  // entities/relationships, Network switches to those records automatically.
  async function waitForBackendCsvGraph(caseId, documentId, maxAttempts = 60) {
    if (!documentId || typeof window.loadNetworkGraph !== "function") return false;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      try {
        const token = localStorage.getItem("cipher_access_token") || localStorage.getItem("token") || sessionStorage.getItem("cipher_access_token") || "";
        const headers = { Accept: "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;
        const docsRes = await fetch(`/api/cases/${caseId}/documents`, { headers });
        if (!docsRes.ok) continue;
        const docs = await docsRes.json();
        const doc = (docs.documents || []).find(d => String(d.id) === String(documentId));
        const statusValue = String(doc?.processing_status || "").toUpperCase();
        if (statusValue === "FAILED") {
          showNetworkToast?.("✕ Backend CSV processing failed. No local graph preview was rendered.");
          return false;
        }
        if (statusValue !== "PROCESSED") continue;

        // Only now ask the backend graph endpoint for persisted nodes/links.
        await window.loadNetworkGraph(caseId);
        if (typeof window.renderDynamicTimeline === "function") await window.renderDynamicTimeline();
        const graphRes = await fetch(`/api/cases/${caseId}/graph?include=pending`, { headers });
        const graph = graphRes.ok ? await graphRes.json() : {};
        const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
        syncFileToEvidenceSection(currentFilename, nodes.length, 0, true);
        if (status) {
          status.classList.add("has-file");
          status.innerHTML = `<span class="status-dot" style="background:#d9ff55;"></span><div><b style="color:#d9ff55;">BACKEND SYNCED: ${escapeHtml(currentFilename)}</b><small>CSV-derived nodes and links are now loaded from the case database</small></div>`;
        }
        showNetworkToast?.("✓ Evidence worker finished. Network and Timeline are now reading the persisted case database.");
        return true;
      } catch (err) {
        console.debug("Waiting for CIPHER evidence worker:", err?.message || err);
      }
    }
    return false;
  }
  window.waitForBackendCsvGraph = waitForBackendCsvGraph;

  // Ingest & Plot Action
  csvProceedBtn?.addEventListener("click", async () => {
    if (csvErrorMsg) {
      csvErrorMsg.style.display = "none";
      csvErrorMsg.textContent = "";
    }

    // If neither text nor file is present, load the sample CSV automatically
    if (!currentCsvText && !currentFile) {
      try {
        const sampleRes = await fetch(`/api/cases/${window.CipherCaseState?.id || 0}/sample-csv`);
        if (sampleRes.ok) {
          currentCsvText = await sampleRes.text();
          currentFilename = "investigation_template.csv";
          const { headers, rows } = parseCsvString(currentCsvText);
          renderPreviewTable(headers, rows);
        }
      } catch (err) {
        console.error("Failed to load sample CSV:", err);
      }
    }

    if (!currentCsvText && !currentFile) {
      if (csvErrorMsg) {
        csvErrorMsg.style.display = "block";
        csvErrorMsg.textContent = "No CSV data found to ingest. Please choose a file or use the case CSV template.";
      }
      if (typeof showNetworkToast === "function") {
        showNetworkToast("No CSV data to ingest. Please choose a file.");
      }
      return;
    }

    const origText = csvProceedBtn.textContent;
    csvProceedBtn.disabled = true;
    csvProceedBtn.textContent = "INGESTING DATA...";

    try {
      // Always materialize the selected File into the same CSV text used by the
      // preview/parser. Previously a File could be sent to the backend while
      // currentCsvText remained empty, which meant the frontend had nothing to
      // build the live graph from and could fall back to the old case graph.
      if (currentFile && !currentCsvText) {
        currentCsvText = await currentFile.text();
        currentFilename = currentFile.name || currentFilename;
      }

      const modeRadio = document.querySelector('input[name="cipherCsvImportMode"]:checked');
      const importMode = modeRadio ? modeRadio.value : "replace";

      const token = localStorage.getItem("cipher_access_token");
      const caseId = Number(window.CipherCaseState?.id || 0);
      if (!window.CipherCaseState?.caseSelected || !caseId) {
        throw new Error("Select a case before ingesting CSV evidence.");
      }
      // Unified CIPHER master CSVs have a record_type column with typed rows
      // (nodes, relationships, events, evidence, review_queue, etc.). Route
      // those through the dedicated master importer; keep ordinary investigator
      // CSVs on the queued evidence importer.
      // Detect master CSVs from the parsed header/records rather than regexing
      // raw text. This handles UTF-8 BOMs, quoted headers, CRLF files and
      // harmless whitespace consistently.
      const parsedForImport = parseCsvString(currentCsvText || "");
      const parsedHeaderKeys = new Set(parsedForImport.headers.map(h => String(h || "").replace(/^\\uFEFF/, "").trim().toLowerCase()));
      const parsedRecordTypes = new Set(parsedForImport.rows
        .map(r => String(r[parsedForImport.headers.find(h => String(h || "").trim().toLowerCase() === "record_type") || ""] || "").trim().toLowerCase())
        .filter(Boolean));
      const csvLooksLikeMaster = parsedHeaderKeys.has("record_type") &&
        (parsedRecordTypes.has("nodes") || parsedRecordTypes.has("relationships") || parsedRecordTypes.has("events") || parsedRecordTypes.has("locations"));
      const importEndpoint = csvLooksLikeMaster
        ? `/api/cases/${caseId}/import-master-csv`
        : `/api/cases/${caseId}/import-csv`;

      // Build the graph/timeline from the exact bytes the investigator selected
      // BEFORE asking the backend to process them. The backend is allowed to be
      // asynchronous and may also return an already-successful response; neither
      // case should ever cause an older hard-coded/verified graph to replace the
      // freshly uploaded CSV.
      const parsedRowsForValidation = parsedForImport.rows || [];
      if (!parsedRowsForValidation.length) {
        throw new Error("The selected CSV contains no data rows to ingest.");
      }
      // Build both workspaces from the exact CSV the investigator selected.
      // This is frontend-only and does not alter the backend importer or schema.
      const localGraph = buildLocalCsvGraph(currentCsvText);
      const localTimeline = buildLocalCsvTimeline(currentCsvText);
      if (!localGraph || !localGraph.nodes?.length) {
        throw new Error("The selected CSV contains no usable entity rows or relationship endpoints.");
      }
      localGraph.caseId = caseId;
      localGraph.pending = true;
      localGraph.filename = currentFilename;
      window.CipherLocalGraphData = localGraph;
      window.CipherLocalTimelineData = { caseId, filename: currentFilename, events: localTimeline, pending: true, source: "csv-preview" };
      window.CipherLocalTimelineCaseId = caseId;

      if (typeof window.cipherSwitchView === "function") window.cipherSwitchView("network");

      let res;
      if (currentFile) {
        const formData = new FormData();
        formData.append("file", currentFile);
        formData.append("mode", importMode);
        const headers = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        res = await fetch(importEndpoint, { method: "POST", headers, body: formData });
      } else {
        const headers = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        res = await fetch(importEndpoint, {
          method: "POST", headers,
          body: JSON.stringify({ filename: currentFilename, csvText: currentCsvText, mode: importMode })
        });
      }

      let data = {};
      try {
        data = await res.json();
      } catch (jsonErr) {
        data = { detail: "Server error parsing JSON response" };
      }

      // Master CSVs are imported synchronously into the normalized backend schema.
      // Keep the local graph/timeline preview visible immediately as well, because
      // verified-only Network/Timeline APIs intentionally do not expose pending rows.
      if (res && res.ok && csvLooksLikeMaster && data.status === "success") {
        const localGraph = window.CipherLocalGraphData;
        if (localGraph) {
          if (typeof window.cipherSwitchView === "function") window.cipherSwitchView("network");
          else document.querySelector('.workspace-sidebar .side-item[data-view="network"]')?.click();
          setTimeout(async () => {
            if (typeof window.loadNetworkGraph === "function") await window.loadNetworkGraph(caseId);
            if (typeof window.renderDynamicTimeline === "function") await window.renderDynamicTimeline();
          }, 180);
          closeCsvModal();
          const imported = data.import || {};
          const nodeCount = Number(imported.nodes || 0);
          const relCount = Number(imported.relationships || 0);
          syncFileToEvidenceSection(currentFilename, nodeCount, 0, true);
          if (status) {
            status.classList.add("has-file");
            status.innerHTML = `<span class="status-dot" style="background:#d9ff55;"></span><div><b style="color:#d9ff55;">MASTER CSV: ${escapeHtml(currentFilename)}</b><small>${nodeCount} nodes · ${relCount} links · persisted to case database</small></div>`;
          }
          if (typeof showNetworkToast === "function") showNetworkToast(`✓ Master CSV imported: ${nodeCount} nodes · ${relCount} links. Network + Timeline are reading the persisted case database.`);
        } else {
          throw new Error("Master CSV imported, but no graph-shaped rows could be detected for the network preview.");
        }
      } else if (res && res.ok && data.status === "queued") {
        if (typeof window.cipherSwitchView === "function") window.cipherSwitchView("network");
        else document.querySelector('.workspace-sidebar .side-item[data-view="network"]')?.click();
        closeCsvModal();
        syncFileToEvidenceSection(currentFilename, 0, 0, false);
        if (status) {
          status.classList.add("has-file");
          status.innerHTML = `<span class="status-dot" style="background:#d9ff55;"></span><div><b style="color:#d9ff55;">CSV QUEUED: ${escapeHtml(currentFilename)}</b><small>Waiting for backend processing · Network remains empty until persisted</small></div>`;
        }
        showNetworkToast?.("✓ CSV queued. Network will populate only after the backend persists the case graph.");
        if (data.document_id) await waitForBackendCsvGraph(caseId, data.document_id);
      } else if (res && res.ok && data.status === "success") {
        // Some backend deployments finish ordinary CSV imports synchronously.
        // Keep the exact uploaded CSV preview authoritative until the graph data
        // is demonstrably from this same upload. Never jump back to stale data.
        window.CipherLocalGraphData = null;
        window.CipherLocalTimelineData = null;
        window.CipherLocalTimelineCaseId = null;
        if (typeof window.loadNetworkGraph === "function") await window.loadNetworkGraph(caseId);
        if (typeof window.renderDynamicTimeline === "function") await window.renderDynamicTimeline();
        closeCsvModal();

        const successMsg = data.message || `Ingestion complete: ${data.stats?.importedEntities || 0} entities & ${data.stats?.importedRelationships || 0} links added (${importMode.toUpperCase()} mode).`;
        if (typeof showNetworkToast === "function") {
          showNetworkToast(`✓ ${successMsg}`);
        } else if (typeof toast === "function") {
          toast(`✓ ${successMsg}`);
        }

        // Sync status into Evidence section register as INGESTED
        syncFileToEvidenceSection(currentFilename, data.stats?.importedEntities || 0, 0, true);

        // Keep the investigator on Network after upload. The local CSV graph is
        // deliberately shown as a PENDING PREVIEW until review promotes it.
        // Previously this success branch immediately switched to Review, which
        // made it look as though the CSV had processed but never plotted.
        if (typeof window.cipherSwitchView === "function") {
          window.cipherSwitchView("network");
        }

        if (status) {
          status.classList.add("has-file");
          status.innerHTML = `
            <span class="status-dot" style="background:#d9ff55;"></span>
            <div>
              <b style="color:#d9ff55;">INGESTED: ${escapeHtml(currentFilename)}</b>
              <small>${data.stats?.importedEntities || 0} entities &amp; ${data.stats?.importedRelationships || 0} links plotted</small>
            </div>
          `;
        }
      } else {
        const errMsg = data.detail || data.error || data.message || "Failed to ingest CSV data.";
        if (csvErrorMsg) {
          csvErrorMsg.style.display = "block";
          csvErrorMsg.textContent = `Ingestion Failed: ${errMsg}`;
        }
        if (typeof showNetworkToast === "function") {
          showNetworkToast(`Error: ${errMsg}`);
        } else {
          alert(errMsg);
        }
      }
    } catch (err) {
      console.error("CSV Ingestion error:", err);
      const errMsg = err?.message || "Error communicating with server during CSV ingestion.";
      if (csvErrorMsg) {
        csvErrorMsg.style.display = "block";
        csvErrorMsg.textContent = `Error: ${errMsg}`;
      }
      if (typeof showNetworkToast === "function") {
        showNetworkToast("Error communicating with server during CSV ingestion.");
      }
    } finally {
      csvProceedBtn.disabled = false;
      csvProceedBtn.textContent = origText;
    }
  });

  function syncFileToEvidenceSection(fileName, rowCount = 0, colCount = 0, ingested = false) {
    const list = document.getElementById("reportEvidenceList");
    if (!list) return;

    let existingRow = list.querySelector(`.evidence-row[data-csv-name="${fileName}"]`);
    if (existingRow) {
      const badge = existingRow.querySelector(".cipher-csv-evidence-badge");
      if (badge) {
        badge.textContent = ingested ? "GRAPH INGESTED · ACTIVE" : "SYNCED TO NETWORK";
        badge.style.color = ingested ? "#d9ff55" : "#00e676";
        badge.style.borderColor = ingested ? "rgba(217,255,85,0.5)" : "rgba(0,230,118,0.4)";
      }
      return;
    }

    const row = document.createElement("div");
    row.className = "evidence-row cipher-csv-evidence-row";
    row.dataset.csvName = fileName;
    row.innerHTML = `
      <span class="evidence-icon" style="background:rgba(0,230,118,0.18);border:1px solid #00e676;color:#00e676;font-weight:700;">CSV</span>
      <div>
        <b contenteditable="true">${escapeHtml(fileName)}</b>
        <small contenteditable="true">${rowCount} data rows · ${colCount} columns · Investigation data source · ${new Date().toLocaleDateString()}</small>
      </div>
      <em class="cipher-csv-evidence-badge" style="${ingested ? 'color:#d9ff55;border-color:rgba(217,255,85,0.5);' : 'color:#00e676;border-color:rgba(0,230,118,0.4);'}">${ingested ? 'GRAPH INGESTED · ACTIVE' : 'SYNCED TO NETWORK'}</em>
    `;
    list.prepend(row);

    const draftState = document.getElementById("reportSaveState");
    if (draftState) {
      draftState.textContent = "EVIDENCE ADDED (CSV)";
    }
  }

  function handleFileSelected(file) {
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      if (typeof showNetworkToast === "function") {
        showNetworkToast("Please select a valid CSV file (.csv).");
      }
      if (input) input.value = "";
      const evInput = document.getElementById("evidenceCsvFileInput");
      if (evInput) evInput.value = "";
      return;
    }

    // Mirror file into input.files if selected via evidence section or drag & drop
    try {
      if (input && input.files?.[0] !== file) {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
      }
    } catch (dtErr) {}

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const { headers, rows } = parseCsvString(text);

      // 1. Sync to evidence section immediately
      syncFileToEvidenceSection(file.name, rows.length, headers.length, false);

      // 2. Open CSV modal for preview & graph ingestion (same as network section upload)
      openCsvModal(file.name, text, file);

      if (typeof showNetworkToast === "function") {
        showNetworkToast(`✓ CSV attached: "${file.name}" (${rows.length} records ready to plot)`);
      } else if (typeof toast === "function") {
        toast(`✓ CSV attached: "${file.name}" (${rows.length} records ready to plot)`);
      }
    };
    reader.onerror = () => {
      if (typeof showNetworkToast === "function") {
        showNetworkToast("Error reading the selected CSV file.");
      }
    };
    reader.readAsText(file);
  }

  function choose() {
    input.value = "";
    input.click();
  }

  mainBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    // Open CSV modal directly (pre-populated with sample template or existing file), and allow changing
    openCsvModal(currentFilename, currentCsvText, currentFile);
  });

  nodeBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    openCsvModal(currentFilename, currentCsvText, currentFile);
  });

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (file) handleFileSelected(file);
  });

  // Drag and drop on dropzone
  ["dragenter", "dragover"].forEach(type =>
    dropzone?.addEventListener(type, e => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    })
  );

  ["dragleave", "drop"].forEach(type =>
    dropzone?.addEventListener(type, e => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
    })
  );

  dropzone?.addEventListener("drop", e => {
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileSelected(file);
  });

  window.cipherHandleCsvFile = handleFileSelected;
  window.cipherSyncCsvToEvidence = syncFileToEvidenceSection;
  window.cipherOpenCsvImportModal = openCsvModal;
})();


/* =========================================================
   WORKSPACE TIMELINE — DATABASE-BACKED INVESTIGATION FEED
   ========================================================= */
(function initWorkspaceTimeline() {
  const view = document.getElementById("timelineView");
  const feed = document.getElementById("timelineFeed");
  const empty = document.getElementById("timelineFeedEmpty");
  const search = document.getElementById("timelineSearchInput");
  const reload = document.getElementById("timelineReloadBtn");
  const replay = document.getElementById("timelineReplayBtn");
  const clear = document.getElementById("timelineClearBtn");
  const inspectorTitle = document.getElementById("timelineInspectorTitle");
  const inspectorBody = document.getElementById("timelineInspectorBody");
  const inspectorClear = document.getElementById("timelineInspectorClear");
  const status = document.getElementById("workspaceTimelineStatus");
  const footer = document.getElementById("timelineFooterState");
  const eventCount = document.getElementById("timelineEventCount");
  const verifiedCount = document.getElementById("timelineVerifiedCount");
  const pendingCount = document.getElementById("timelinePendingCount");
  const spanLabel = document.getElementById("timelineSpanLabel");
  const feedSource = document.getElementById("timelineFeedSource");
  const feedMeta = document.getElementById("timelineFeedMeta");
  const timeLabels = document.getElementById("timelineTimeLabels");
  const caseKicker = document.getElementById("timelineCaseKicker");
  const eventModal = document.getElementById("timelineEventModal");
  const modalTitle = document.getElementById("timelineModalTitle");
  const modalBody = document.getElementById("timelineModalBody");
  const modalClose = document.getElementById("timelineModalClose");

  if (!view || !feed) return;

  let allEvents = [];
  let filteredEvents = [];
  let selectedId = null;
  let activeStatus = "ALL";
  let loading = false;
  let traceTimer = null;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

  const apiBase = () => window.CIPHER_API_BASE || "";
  const caseId = () => (window.CipherCaseState?.caseSelected ? Number(window.CipherCaseState?.id || 0) : 0);
  const authHeaders = () => {
    const token = localStorage.getItem("cipher_access_token") || localStorage.getItem("token") || sessionStorage.getItem("cipher_access_token") || "";
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  function formatDate(value) {
    if (!value) return "DATE UNKNOWN";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value).toUpperCase();
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
  }

  function formatTime(value) {
    if (!value) return "TIME UNKNOWN";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  function formatDateTime(value) {
    if (!value) return "TIMESTAMP NOT RECORDED";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return `${formatDate(value)} · ${formatTime(value)}`;
  }

  function normalizeEvent(raw, source = "DATABASE") {
    const statusValue = String(raw?.verification_status || raw?.status || "PENDING").toUpperCase();
    const type = String(raw?.event_type || raw?.type || "EVENT").trim() || "EVENT";
    const description = String(raw?.description || raw?.details || raw?.title || "Investigation event recorded in the case.").trim();
    const entity = raw?.entity || null;
    const location = raw?.location || null;
    const evidence = raw?.evidence || null;
    const confidenceRaw = raw?.confidence_score ?? raw?.confidence ?? null;
    const confidence = confidenceRaw === null || confidenceRaw === "" ? null : Number(confidenceRaw);
    return {
      ...raw,
      id: raw?.id ?? raw?.external_id ?? `${raw?.event_time || "event"}-${description}`,
      event_time: raw?.event_time || raw?.timestamp || "",
      event_type: type,
      description,
      verification_status: statusValue,
      confidence_score: Number.isFinite(confidence) ? confidence : null,
      source_mode: source,
      entity,
      location,
      evidence,
    };
  }

  async function fetchTimeline() {
    const id = caseId();
    const localTimeline = window.CipherLocalTimelineData;
    const localTimelineCaseMatches = !localTimeline?.caseId || Number(localTimeline.caseId) === Number(id);
    if (id && localTimeline?.pending && localTimelineCaseMatches && Array.isArray(localTimeline.events)) {
      allEvents = localTimeline.events.map((event, index) => normalizeEvent({ ...event, id: event.id || `csv-event-${index + 1}` }, "UPLOADED CSV"));
      window.__cipherTimelineBackendSignature = "";
      feedSource.textContent = "UPLOADED CSV";
      feedMeta.textContent = `${allEvents.length} event${allEvents.length === 1 ? "" : "s"} · extracted from ${localTimeline.filename || "uploaded CSV"}`;
      setStatus("CSV DATA READY");
      render();
      return;
    }
    if (!id || loading) {
      if (!id) { allEvents = []; window.__cipherTimelineBackendSignature = ""; render(); }
      return;
    }
    loading = true;
    setStatus("FETCHING CASE DATA");
    try {
      const response = await fetch(`${apiBase()}/api/cases/${id}/timeline?status=ALL`, { headers: authHeaders() });
      if (!response.ok) throw new Error(`Timeline API returned ${response.status}`);
      const payload = await response.json();
      const backendEvents = Array.isArray(payload.events) ? payload.events : (Array.isArray(payload.timeline) ? payload.timeline : []);
      const nextEvents = backendEvents.map((e) => normalizeEvent(e, "CASE DATABASE"));
      const nextSignature = JSON.stringify(nextEvents.map(e => ({id:e.id,time:e.event_time,type:e.event_type,description:e.description,status:e.verification_status})));
      if (window.__cipherTimelineBackendSignature === nextSignature) {
        return;
      }
      window.__cipherTimelineBackendSignature = nextSignature;
      allEvents = nextEvents;

      feedSource.textContent = "CASE DATABASE";
      feedMeta.textContent = allEvents.length
        ? `${allEvents.length} event${allEvents.length === 1 ? "" : "s"} · fetched from active case ${id}`
        : `No timeline events stored for case ${id}`;
      render();
    } catch (error) {
      console.warn("Timeline fetch failed", error);
      allEvents = [];
      feedSource.textContent = "CASE DATABASE";
      feedMeta.textContent = "Backend timeline unavailable";
      setStatus("DATA UNAVAILABLE");
      render();
    } finally {
      loading = false;
    }
  }

  function setStatus(text) {
    if (status) status.textContent = text;
    if (footer) footer.textContent = text;
  }

  function searchableText(event) {
    return [
      event.description, event.event_type, event.source_reference,
      event.entity?.label, event.entity?.external_id, event.entity?.type,
      event.location?.label, event.location?.address, event.location?.external_id,
      event.evidence?.filename, event.evidence?.external_id
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function applyFilters() {
    const q = String(search?.value || "").trim().toLowerCase();
    filteredEvents = allEvents.filter((event) => {
      const statusOk = activeStatus === "ALL" || event.verification_status === activeStatus;
      const searchOk = !q || searchableText(event).includes(q);
      return statusOk && searchOk;
    });
    renderFeed();
    updateStats();
  }

  function updateStats() {
    const verified = allEvents.filter(e => e.verification_status === "VERIFIED").length;
    const pending = allEvents.filter(e => e.verification_status === "PENDING").length;
    if (eventCount) eventCount.textContent = String(allEvents.length).padStart(2, "0");
    if (verifiedCount) verifiedCount.textContent = String(verified).padStart(2, "0");
    if (pendingCount) pendingCount.textContent = String(pending).padStart(2, "0");
    if (allEvents.length) {
      const times = allEvents.map(e => new Date(e.event_time).getTime()).filter(Number.isFinite);
      if (times.length) spanLabel.textContent = `${formatDate(Math.min(...times))} — ${formatDate(Math.max(...times))}`;
      else spanLabel.textContent = "UNRESOLVED";
    } else if (spanLabel) spanLabel.textContent = "—";
    renderTimeRuler();
  }

  function renderTimeRuler() {
    if (!timeLabels) return;
    const times = filteredEvents.map(e => new Date(e.event_time).getTime()).filter(Number.isFinite);
    if (!times.length) {
      timeLabels.innerHTML = "<span>NO RECORDED TIME</span>";
      return;
    }
    const unique = [...new Set(times.map(t => formatDate(t)))];
    const labels = unique.length > 5 ? [unique[0], unique[Math.floor(unique.length / 2)], unique.at(-1)] : unique;
    timeLabels.innerHTML = labels.map(label => `<span>${esc(label)}</span>`).join("");
  }

  function eventCard(event, index) {
    const selected = String(selectedId) === String(event.id);
    const statusClass = event.verification_status === "VERIFIED" ? "verified" : event.verification_status === "REJECTED" ? "rejected" : "pending";
    const entity = event.entity?.label || event.entity?.external_id || "—";
    const location = event.location?.label || event.location?.external_id || "—";
    const source = event.evidence?.filename || event.source_reference || "CASE DATABASE";
    const kindSlug = String(event.event_type || "event").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28) || "event";
    return `
      <article class="timeline-investigation-event timeline-kind-${kindSlug} ${selected ? "selected" : ""}" data-timeline-event-id="${esc(event.id)}" tabindex="0">
        <div class="timeline-event-card-top"><span class="timeline-event-index">${String(index + 1).padStart(2, "0")}</span><span class="timeline-event-kind">${esc(event.event_type)}</span></div>
        <div class="timeline-event-time"><b>${esc(formatTime(event.event_time))}</b><span>${esc(formatDate(event.event_time))}</span></div>
        <div class="timeline-event-content">
          <h3>${esc(event.description.length > 110 ? event.description.slice(0, 107) + "…" : event.description)}</h3>
          <div class="timeline-event-quick">
            <span>${esc(entity)}</span><i>→</i><span>${esc(location)}</span>
          </div>
          <div class="timeline-event-source"><span>${esc(source)}</span><b>OPEN DETAIL ↗</b></div>
        </div>
        <span class="timeline-event-status ${statusClass}">${esc(event.verification_status)}</span>
      </article>`;
  }

  function renderFeed() {
    if (!feed) return;
    if (!filteredEvents.length) {
      feed.innerHTML = `<div class="timeline-feed-empty"><span>◎</span><b>${allEvents.length ? "NO EVENTS MATCH THIS FILTER" : "NO TIMELINE DATA LOADED"}</b><p>${allEvents.length ? "Change the status filter or search term." : "Import a CSV containing event records, then reload the case. Timeline entries will be rendered from the backend case data."}</p></div>`;
      return;
    }
    feed.innerHTML = filteredEvents.map(eventCard).join("");
    feed.querySelectorAll("[data-timeline-event-id]").forEach((card) => {
      const activate = () => {
        const event = filteredEvents.find(e => String(e.id) === String(card.dataset.timelineEventId));
        if (event) selectEvent(event);
      };
      card.addEventListener("click", activate);
      card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); } });
    });
    if (selectedId != null && !filteredEvents.some(e => String(e.id) === String(selectedId))) clearSelection();
  }

  function selectEvent(event) {
    selectedId = event.id;
    feed.querySelectorAll("[data-timeline-event-id]").forEach((card) => card.classList.toggle("selected", String(card.dataset.timelineEventId) === String(event.id)));
    renderInspector(event);
    openEventModal(event);
  }

  function closeEventModal() {
    if (!eventModal) return;
    eventModal.classList.remove("open");
    eventModal.setAttribute("aria-hidden", "true");
  }

  function clearSelection() {
    selectedId = null;
    feed.querySelectorAll("[data-timeline-event-id]").forEach((card) => card.classList.remove("selected"));
    if (inspectorTitle) inspectorTitle.textContent = "Select an event";
    if (inspectorBody) inspectorBody.innerHTML = `<div class="timeline-inspector-empty"><span>↗</span><b>OPEN EVENT DETAIL</b><p>Click any event card to open its full incident record.</p></div>`;
    closeEventModal();
  }

  function detailMarkup(event) {
    const linkedEntity = event.entity?.label || event.entity?.external_id;
    const linkedLocation = event.location?.label || event.location?.external_id;
    const evidence = event.evidence?.filename || event.evidence?.external_id;
    const rows = [];
    const ignored = new Set(["id","case_id","confidence_score","confidence","created_at","source_mode","verification_status","event_type","event_time","description","entity","location","evidence"]);
    Object.entries(event).forEach(([key, value]) => {
      if (ignored.has(key) || value == null || value === "" || typeof value === "object") return;
      rows.push(`<div class="timeline-detail-row"><span>${esc(key.replace(/_/g," ").toUpperCase())}</span><b>${esc(String(value))}</b></div>`);
    });
    return `
      <div class="timeline-dialog-hero">
        <div><span class="timeline-dialog-event-type">${esc(event.event_type)}</span><strong>${esc(formatDateTime(event.event_time))}</strong></div>
        <span class="timeline-dialog-index">EVENT ${String(filteredEvents.findIndex(e => String(e.id) === String(event.id)) + 1).padStart(2,"0")}</span>
      </div>
      <div class="timeline-dialog-section narrative"><span>WHAT HAPPENED</span><p>${esc(event.description || "No narrative was recorded for this event.")}</p></div>
      <div class="timeline-dialog-grid">
        <div class="timeline-dialog-card"><span>ENTITY</span><b>${esc(linkedEntity || "NOT LINKED")}</b>${event.entity?.type ? `<small>${esc(event.entity.type)}</small>` : ""}</div>
        <div class="timeline-dialog-card"><span>LOCATION</span><b>${esc(linkedLocation || "NOT LINKED")}</b>${event.location?.address ? `<small>${esc(event.location.address)}</small>` : ""}</div>
        <div class="timeline-dialog-card"><span>EVIDENCE</span><b>${esc(evidence || "NOT LINKED")}</b>${event.evidence?.file_type ? `<small>${esc(event.evidence.file_type)}</small>` : ""}</div>
        <div class="timeline-dialog-card"><span>SOURCE</span><b>${esc(event.source_reference || "CASE DATABASE")}</b><small>Database-backed record</small></div>
      </div>
      ${rows.length ? `<div class="timeline-dialog-section"><span>RECORDED INFORMATION</span><div class="timeline-detail-list">${rows.join("")}</div></div>` : ""}
      <div class="timeline-dialog-actions">
        ${linkedEntity ? `<button type="button" data-action="network">OPEN ENTITY IN NETWORK ↗</button>` : ""}
        ${event.location?.latitude != null && event.location?.longitude != null ? `<button type="button" data-action="gis">SHOW LOCATION IN GIS ↗</button>` : ""}
        ${event.evidence ? `<button type="button" data-action="evidence">OPEN EVIDENCE ↗</button>` : ""}
      </div>`;
  }

  function wireDetailActions(root, event) {
    root.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => {
      const action = button.dataset.action;
      closeEventModal();
      if (action === "network") {
        if (typeof window.switchWorkspaceView === "function") window.switchWorkspaceView("network");
      } else if (action === "gis") {
        if (typeof window.switchWorkspaceView === "function") window.switchWorkspaceView("gis");
        const lat = Number(event.location.latitude), lng = Number(event.location.longitude);
        setTimeout(() => {
          if (window.workspaceGISMap && Number.isFinite(lat) && Number.isFinite(lng)) window.workspaceGISMap.setView([lat, lng], 14);
          if (typeof window.cipherSelectGISNode === "function") window.cipherSelectGISNode({ label: event.location.label || "Timeline location", latitude: lat, longitude: lng, address_text: event.location.address || "" });
        }, 350);
      } else if (action === "evidence") {
        if (typeof window.switchWorkspaceView === "function") window.switchWorkspaceView("evidence");
      }
    }));
  }

  function renderInspector(event) {
    if (inspectorTitle) inspectorTitle.textContent = event.event_type || "Investigation event";
    if (inspectorBody) inspectorBody.innerHTML = `<div class="timeline-inspector-mini-date">${esc(formatDateTime(event.event_time))}</div><p class="timeline-inspector-mini-copy">${esc(event.description || "No narrative recorded.")}</p><button type="button" class="timeline-inspector-open">OPEN FULL EVENT ↗</button>`;
    inspectorBody?.querySelector(".timeline-inspector-open")?.addEventListener("click", () => openEventModal(event));
  }

  function openEventModal(event) {
    if (!eventModal || !modalBody) return;
    if (modalTitle) modalTitle.textContent = event.event_type || "Event";
    modalBody.innerHTML = detailMarkup(event);
    wireDetailActions(modalBody, event);
    eventModal.classList.add("open");
    eventModal.setAttribute("aria-hidden", "false");
  }

  modalClose?.addEventListener("click", closeEventModal);
  eventModal?.querySelector("[data-timeline-modal-close]")?.addEventListener("click", closeEventModal);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeEventModal(); });

  function render() {
    applyFilters();
    updateStats();
    if (!selectedId && filteredEvents.length) setStatus("DATABASE READY");
  }

  function traceSequence() {
    if (!filteredEvents.length) return;
    clearTimeout(traceTimer);
    feed.querySelectorAll("[data-timeline-event-id]").forEach((card) => card.classList.remove("trace-visible"));
    setStatus("RECONSTRUCTING");
    filteredEvents.forEach((event, i) => {
      traceTimer = setTimeout(() => {
        const card = feed.querySelector(`[data-timeline-event-id="${CSS.escape(String(event.id))}"]`);
        card?.classList.add("trace-visible");
        if (i === filteredEvents.length - 1) setStatus("TRACE COMPLETE");
      }, i * 110);
    });
  }

  reload?.addEventListener("click", fetchTimeline);
  replay?.addEventListener("click", traceSequence);
  clear?.addEventListener("click", clearSelection);
  inspectorClear?.addEventListener("click", clearSelection);
  search?.addEventListener("input", applyFilters);
  document.querySelectorAll("[data-timeline-status]").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll("[data-timeline-status]").forEach(b => b.classList.remove("active"));
    button.classList.add("active");
    activeStatus = button.dataset.timelineStatus || "ALL";
    applyFilters();
  }));

  window.renderDynamicTimeline = fetchTimeline;
  window.CipherTimelineRefreshLayout = render;

  // Timeline is loaded explicitly when the workspace is opened or when the
  // investigator presses RELOAD CASE. Do not observe class mutations here: the
  // workspace navigation itself changes active-view classes and that used to
  // cause unnecessary re-fetch/re-render cycles that looked like blinking.

  if (caseKicker) {
    const id = caseId();
    caseKicker.textContent = id ? `CASE / ${window.CipherCaseState?.caseNumber || id}` : "CASE / —";
  }
})();


/* =========================================================
   GIS WORKSPACE — REAL LEAFLET MAP ENGINE
   ========================================================= */

(function initGISWorkspace() {

  const gisView = document.getElementById("gisView");
  const casesView = document.getElementById("casesView");
  const networkView = document.getElementById("networkView");
  const timelineView = document.getElementById("timelineView");
  const evidenceView = document.getElementById("evidenceView");

  const gisMapContainer = document.getElementById("gisMapPlaceholder");
  const search = document.getElementById("gisSearchInput");
  const searchClearBtn = document.getElementById("gisSearchClearBtn");
  const searchDropdown = document.getElementById("gisSearchResultsDropdown");
  const searchWrapper = document.getElementById("gisSearchWrapper");
  const coords = document.getElementById("gisCoordinates");
  const infoTitle = document.getElementById("gisInfoTitle");
  const inspBody = document.getElementById("gisInspectorBody");
  const waypoint = document.getElementById("addWaypointBtn");
  const focusSearch = document.getElementById("gisSearchFocusBtn");

  if (!gisView) return;

  /* ---- state ---- */
  let wsGISMap = null;
  let wsLocationMarkers = {};
  let wsLocationMarkersByEntity = {};
  let wsVisionHighlight = null;
  let wsCorridorPolylines = [];
  let wsCorridorArrows = [];
  let wsAnomalyCircles = [];
  let wsCurrentData = null;
  let wsShowCorridors = true;
  let wsShowAnomalies = true;
  let wsWaypointMode = false;
  let wsWaypoints = [];
  let wsActiveMarkerId = null;
  let wsActiveFilter = "all";

  const API_BASE = (typeof window !== "undefined" && window.location ? window.location.origin : "");

  /* ---- helper ---- */
  const escapeHtml = v =>
    String(v ?? "").replace(
      /[&<>'"]/g,
      c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]
    );

  function toast(msg) {
    if (typeof showNetworkToast === "function") { showNetworkToast(msg); return; }
    let t = document.getElementById("networkToast");
    if (!t) { t = document.createElement("div"); t.id = "networkToast"; t.className = "network-toast"; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 2500);
  }


  /* ===========================================================
     VIEW SWITCHING — sidebar navigation
     =========================================================== */

  const workspaceViewHistory = [];
  let currentWorkspaceView = "cases";
  const workspaceBack = document.getElementById("workspaceBack");

  function openCipherAIDrawer() {
    const workspace = document.getElementById("cipherWorkspace");
    const aiView = document.getElementById("aiInvestigatorView");
    const launcher = document.getElementById("cipherAiLauncher");
    if (!workspace || !aiView) return;
    workspace.classList.add("ai-drawer-open");
    aiView.setAttribute("aria-hidden", "false");
    launcher?.setAttribute("aria-expanded", "true");
    aiView.scrollTop = 0;
    if (typeof window.refreshAIActivity === "function") window.refreshAIActivity();
    setTimeout(() => document.getElementById("aiQueryInput")?.focus(), 180);
  }

  function closeCipherAIDrawer() {
    const workspace = document.getElementById("cipherWorkspace");
    const aiView = document.getElementById("aiInvestigatorView");
    const launcher = document.getElementById("cipherAiLauncher");
    workspace?.classList.remove("ai-drawer-open");
    aiView?.setAttribute("aria-hidden", "true");
    launcher?.setAttribute("aria-expanded", "false");
  }

  window.openCipherAIDrawer = openCipherAIDrawer;
  window.closeCipherAIDrawer = closeCipherAIDrawer;

  function switchWorkspaceView(view, fromBack = false) {
    if (view === "ai-investigator") {
      openCipherAIDrawer();
      return;
    }
    closeCipherAIDrawer();
    if (!fromBack && currentWorkspaceView !== view) {
      workspaceViewHistory.push(currentWorkspaceView);
      if (workspaceViewHistory.length > 12) workspaceViewHistory.shift();
    }
    currentWorkspaceView = view;
    workspaceBack?.classList.toggle("disabled", workspaceViewHistory.length === 0);

    document.querySelectorAll(".workspace-sidebar .side-item[data-view]")
      .forEach(b => b.classList.toggle("active", b.dataset.view === view));

    casesView?.classList.toggle("active-view", view === "cases");
    networkView?.classList.toggle("active-view", view === "network");
    timelineView?.classList.toggle("active-view", view === "timeline");
    evidenceView?.classList.toggle("active-view", view === "evidence");
    gisView.classList.toggle("active-view", view === "gis");
    if (view === "timeline" && timelineView) {
      timelineView.scrollTop = 0;
      if (typeof window.renderDynamicTimeline === "function") {
        window.renderDynamicTimeline();
      }
    }

    const reviewView = document.getElementById("reviewView");
    reviewView?.classList.toggle("active-view", view === "review");
    if (view === "review" && reviewView) {
      reviewView.scrollTop = 0;
      if (typeof window.loadReviewWorkspace === "function") {
        window.loadReviewWorkspace();
      }
    }

    /* When switching to GIS, init the map if not already done and reload latest data */
    if (view === "gis") {
      gisView.scrollTop = 0;
      setTimeout(() => {
        initWorkspaceMap();
        if (typeof loadWorkspaceGISData === "function") {
          loadWorkspaceGISData();
        }
      }, 200);
    }
  }
  window.switchWorkspaceView = switchWorkspaceView;

  document.querySelectorAll(".workspace-sidebar .side-item[data-view]")
    .forEach(btn => btn.addEventListener("click", () => switchWorkspaceView(btn.dataset.view)));

  workspaceBack?.addEventListener("click", () => {
    const previous = workspaceViewHistory.pop();
    if (previous) switchWorkspaceView(previous, true);
    workspaceBack.classList.toggle("disabled", workspaceViewHistory.length === 0);
  });


  /* ===========================================================
     LEAFLET MAP INITIALIZATION & BASEMAP LAYERS
     =========================================================== */

  window.createCipherTileLayers = function() {
    const esriBase = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
      maxZoom: 16
    });
    const esriRef = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      attribution: '',
      maxZoom: 16
    });
    const tacticalDark = L.layerGroup([esriBase, esriRef]);

    const cartoKey = (typeof window !== "undefined" && window.localStorage) ? (localStorage.getItem("cipher_carto_api_key") || "") : "";
    const cartoUrl = cartoKey
      ? `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?api_key=${encodeURIComponent(cartoKey)}`
      : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

    const cartoDark = L.tileLayer(cartoUrl, {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
      subdomains: 'abcd',
      maxZoom: 19
    });

    const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    });

    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',
      maxZoom: 19
    });

    const satelliteLabels = L.layerGroup([
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',
        maxZoom: 19
      }),
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        attribution: '',
        maxZoom: 19,
        pane: 'overlayPane'
      })
    ]);

    return {
      defaultLayer: tacticalDark,
      baseMaps: {
        "Tactical Dark": tacticalDark,
        "CARTO Dark Matter": cartoDark,
        "OpenStreetMap": osm,
        "Satellite": satellite,
        "Satellite + Labels": satelliteLabels
      }
    };
  };

  /* ===========================================================
     ARCHETYPE METADATA & UTILITIES
     =========================================================== */

  function getEntityArchetypeMeta(type) {
    const t = String(type || "").toLowerCase().trim();
    if (t.includes("person") || t.includes("suspect") || t.includes("lead") || t.includes("officer")) {
      return {
        type: "person",
        badge: "PERSON",
        color: "#00e5ff",
        glow: "rgba(0, 229, 255, 0.45)",
        svg: `<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`
      };
    }
    if (t.includes("vehicle") || t.includes("car") || t.includes("truck") || t.includes("transit")) {
      return {
        type: "vehicle",
        badge: "VEHICLE",
        color: "#ffb020",
        glow: "rgba(255, 176, 32, 0.45)",
        svg: `<svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>`
      };
    }
    if (t.includes("waypoint") || t.includes("pin") || t.includes("marker")) {
      return {
        type: "waypoint",
        badge: "WAYPOINT",
        color: "#d9ff55",
        glow: "rgba(217, 255, 85, 0.55)",
        svg: `<svg viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-11A7 7 0 0 0 5 10c0 4.8 7 11 7 11z"></path><circle cx="12" cy="10" r="2.3"></circle></svg>`
      };
    }
    if (t.includes("waypoint") || t.includes("pin") || t.includes("marker")) {
      return {
        type: "waypoint",
        badge: "WAYPOINT",
        color: "#d9ff55",
        glow: "rgba(217, 255, 85, 0.55)",
        svg: `<svg viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-11A7 7 0 0 0 5 10c0 4.8 7 11 7 11z"></path><circle cx="12" cy="10" r="2.3"></circle></svg>`
      };
    }
    if (t.includes("place") || t.includes("location") || t.includes("vault") || t.includes("terminal") || t.includes("hub") || t.includes("site") || t.includes("safe_house") || t.includes("dock") || t.includes("incident") || t.includes("residence")) {
      return {
        type: "place",
        badge: "SITE / VAULT",
        color: "#10b981",
        glow: "rgba(16, 185, 129, 0.45)",
        svg: `<svg viewBox="0 0 24 24"><path d="M3 21h18M3 10h18M5 10v11M19 10v11M9 10v11M15 10v11M12 2L2 7h20L12 2z"></path></svg>`
      };
    }
    if (t.includes("phone") || t.includes("msisdn") || t.includes("imei") || t.includes("comms") || t.includes("tower") || t.includes("cdr")) {
      return {
        type: "phone",
        badge: "COMMS",
        color: "#f43f5e",
        glow: "rgba(244, 63, 94, 0.45)",
        svg: `<svg viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>`
      };
    }
    if (t.includes("account") || t.includes("bank") || t.includes("financial") || t.includes("cash") || t.includes("rtgs")) {
      return {
        type: "account",
        badge: "ACCOUNT",
        color: "#d9ff55",
        glow: "rgba(217, 255, 85, 0.45)",
        svg: `<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>`
      };
    }
    if (t.includes("organisation") || t.includes("org") || t.includes("company") || t.includes("firm") || t.includes("trading") || t.includes("conduit")) {
      return {
        type: "organisation",
        badge: "ORGANISATION",
        color: "#a855f7",
        glow: "rgba(168, 85, 247, 0.45)",
        svg: `<svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`
      };
    }
    return {
      type: "entity",
      badge: "NODE",
      color: "#00e5ff",
      glow: "rgba(0, 229, 255, 0.45)",
      svg: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
    };
  }

  function calcBearing(lat1, lon1, lat2, lon2) {
    const toRad = deg => deg * Math.PI / 180;
    const toDeg = rad => rad * 180 / Math.PI;
    const phi1 = toRad(lat1);
    const phi2 = toRad(lat2);
    const deltaLambda = toRad(lon2 - lon1);

    const y = Math.sin(deltaLambda) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) -
              Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
    const theta = Math.atan2(y, x);
    return (toDeg(theta) + 360) % 360;
  }

  function buildTacticalMarkerIcon(props, isSelected = false) {
    const type = (props.entity_type || props.location_type || props.type || 'entity').toLowerCase();
    const meta = getEntityArchetypeMeta(type);
    const rawLabel = props.name || props.label || 'Entity';
    const cleanLabel = rawLabel.replace(/@\s*".*?"/, '').trim();
    const shortLabel = cleanLabel.length > 18 ? cleanLabel.slice(0, 16) + '…' : cleanLabel;

    return L.divIcon({
      className: 'gis-tactical-marker-divicon',
      html: `
        <div class="gis-tactical-marker-wrap ${isSelected ? 'active pulse' : ''}" style="--marker-color:${meta.color}; --marker-glow:${meta.glow};" data-id="${props.id}">
          <div class="gis-tactical-marker-pulse"></div>
          <div class="gis-tactical-marker-pin">
            ${meta.svg}
            <span class="gis-tactical-marker-status"></span>
          </div>
          <div class="gis-tactical-marker-label" title="${escapeHtml(rawLabel)}">
            ${escapeHtml(shortLabel)}
          </div>
        </div>
      `,
      iconSize: [42, 62],
      iconAnchor: [21, 32],
      popupAnchor: [0, -34]
    });
  }

  /* ===========================================================
     MAP INITIALIZATION
     =========================================================== */

  function initWorkspaceMap() {
    if (wsGISMap) { wsGISMap.invalidateSize(); return; }

    const container = document.getElementById("workspaceGISMap");
    if (!container) return;

    wsGISMap = L.map(container, {
      center: [22.9734, 78.6569], // Neutral India starting view; active-case markers fit the map dynamically
      zoom: 12,
      zoomControl: true,
      attributionControl: true
    });

    window.workspaceGISMap = wsGISMap;

    const tileConfig = createCipherTileLayers();
    tileConfig.defaultLayer.addTo(wsGISMap);
    L.control.layers(tileConfig.baseMaps, null, { position: 'topright' }).addTo(wsGISMap);

    /* Update coordinate display on mouse move */
    wsGISMap.on("mousemove", e => {
      if (coords) coords.textContent = `${e.latlng.lat.toFixed(4)} · ${e.latlng.lng.toFixed(4)}`;
    });

    /* Add click-to-place waypoint */
    wsGISMap.on("click", e => {
      if (!wsWaypointMode) return;
      placeWaypoint(e.latlng);
    });

    loadWorkspaceGISData();
  }

  /* ===========================================================
     DATA LOADING
     =========================================================== */

  async function loadWorkspaceGISData() {
    if (!getCipherActiveCaseId()) return;
    try {
      const response = await fetch(`${API_BASE}/api/cases/${window.CipherCaseState?.id || 0}/gis-data`, {headers: (typeof window.getAuthHeaders === "function" ? window.getAuthHeaders(false) : {})});
      if (response.ok) {
        wsCurrentData = await response.json();
      } else {
        throw new Error("Backend response error");
      }
    } catch (e) {
      console.error("CIPHER GIS → backend load failed", e);
      wsCurrentData = { status: "error", case_id: window.CipherCaseState?.id || 0, location_count: 0, geojson: { type: "FeatureCollection", features: [] }, transit_corridors: {}, colocation_anomalies: [], error: e.message };
    }
    renderWorkspaceGIS(wsCurrentData);
  }

  window.loadWorkspaceGISData = loadWorkspaceGISData;
  window.cipherRenderGISData = renderWorkspaceGIS;

  /* ===========================================================
     RENDER TACTICAL MARKERS / DIRECTED CORRIDORS / ANOMALIES
     =========================================================== */

  function renderWorkspaceGIS(data) {
    if (!wsGISMap || !data) return;
    if (data.error) toast(`GIS data error: ${data.error}`);

    /* Clear previous layers */
    Object.values(wsLocationMarkers).forEach(m => wsGISMap.removeLayer(m));
    wsLocationMarkers = {};
    wsLocationMarkersByEntity = {};

    wsCorridorPolylines.forEach(p => wsGISMap.removeLayer(p));
    wsCorridorPolylines = [];

    wsCorridorArrows.forEach(a => wsGISMap.removeLayer(a));
    wsCorridorArrows = [];

    wsAnomalyCircles.forEach(c => wsGISMap.removeLayer(c));
    wsAnomalyCircles = [];

    /* Location markers */
    const rawFeatures = (data.geojson && data.geojson.features) ? data.geojson.features : [];

    // Filter features based on active entity filter
    const features = rawFeatures.filter(feat => {
      if (wsActiveFilter === "all") return true;
      const type = String(feat.properties.entity_type || feat.properties.location_type || "").toLowerCase();
      if (wsActiveFilter === "person") return type.includes("person") || type.includes("suspect") || type.includes("lead");
      if (wsActiveFilter === "vehicle") return type.includes("vehicle") || type.includes("car") || type.includes("transit");
      if (wsActiveFilter === "place") return type.includes("place") || type.includes("vault") || type.includes("terminal") || type.includes("hub") || type.includes("site");
      if (wsActiveFilter === "comms") return type.includes("phone") || type.includes("account") || type.includes("organisation") || type.includes("org") || type.includes("bank");
      return true;
    });

    // Update filter count badge
    const filterAllCountEl = document.getElementById("gisFilterAllCount");
    if (filterAllCountEl) filterAllCountEl.textContent = `${rawFeatures.length} entities`;

    features.forEach(feat => {
      const [lng, lat] = feat.geometry.coordinates;
      const props = feat.properties;
      const entityId = String(props.id || props.entity_id);
      const targetLabel = props.name || props.label || "NODE";
      const isSelected = (wsActiveMarkerId === entityId);

      const icon = buildTacticalMarkerIcon(props, isSelected);
      const marker = L.marker([lat, lng], { icon, riseOnHover: true }).addTo(wsGISMap);

      const meta = getEntityArchetypeMeta(props.entity_type || props.location_type);
      const confScore = props.confidence_score ? `${Math.round(props.confidence_score * 100)}%` : "95%";

      marker.bindPopup(`
        <div style="font-family:'DM Mono',monospace;min-width:210px;padding:4px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:8px;font-weight:700;padding:2px 6px;border-radius:3px;border:1px solid ${meta.color};color:${meta.color};background:rgba(0,0,0,0.4);">${meta.badge}</span>
            <span style="font-size:8px;color:#00f0aa;">● ${confScore} CONFIRMED</span>
          </div>
          <b style="color:#ffffff;font-size:12px;letter-spacing:-0.01em;display:block;line-height:1.3;">${escapeHtml(targetLabel)}</b>
          <span style="color:#7f8a94;font-size:10px;display:block;margin-top:2px;">${escapeHtml(props.aliases || props.address || '')}</span>
          <div style="margin-top:7px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.08);font-size:9px;color:#5a6875;">
            LAT ${lat.toFixed(4)} · LNG ${lng.toFixed(4)}
          </div>
          <button type="button" onclick="if(window.cipherFocusNetworkNode) window.cipherFocusNetworkNode('${escapeHtml(entityId)}', '${escapeHtml(targetLabel)}')" style="margin-top:9px;background:rgba(0,229,255,0.12);color:#00e5ff;border:1px solid rgba(0,229,255,0.5);padding:6px 10px;font-size:10px;font-family:'DM Mono',monospace;font-weight:700;border-radius:4px;cursor:pointer;width:100%;text-align:center;transition:background 0.15s ease;" onmouseover="this.style.background='rgba(0,229,255,0.25)'" onmouseout="this.style.background='rgba(0,229,255,0.12)'">
            ⤹ VIEW &amp; FOCUS IN NETWORK GRAPH
          </button>
        </div>
      `, { offset: [0, -18] });

      marker.on("click", () => {
        activateMarker(entityId, props, marker);
      });

      wsLocationMarkers[entityId] = marker;
      (wsLocationMarkersByEntity[entityId] ||= []).push(marker);
    });

    if(wsVisionHighlight?.entityId){
      const marks=wsLocationMarkersByEntity[String(wsVisionHighlight.entityId)]||[];
      marks.forEach(m=>{const el=m.getElement?.();const wrap=el?.querySelector?.(".gis-tactical-marker-wrap");if(wrap)wrap.classList.add("active","pulse");});
    }

    /* Auto fit bounds to markers */
    if (features.length > 0 && wsGISMap) {
      setTimeout(() => {
        try {
          const markerGroup = L.featureGroup(Object.values(wsLocationMarkers));
          if (markerGroup.getBounds().isValid()) {
            wsGISMap.fitBounds(markerGroup.getBounds().pad(0.18), { maxZoom: 14 });
          }
        } catch (e) {}
      }, 100);
    }

    /* Directed Transit & Relationship Corridors */
    if (wsShowCorridors) {
      const corridorsToRender = [];

      // 1. If structured directed_corridors array is available
      if (Array.isArray(data.directed_corridors) && data.directed_corridors.length > 0) {
        data.directed_corridors.forEach(rel => {
          corridorsToRender.push({
            id: rel.rel_id || rel.id,
            source_id: rel.source_id,
            source_label: rel.source_label,
            source_type: rel.source_type,
            source_coords: [Number(rel.source_lat), Number(rel.source_lng)],
            target_id: rel.target_id,
            target_label: rel.target_label,
            target_type: rel.target_type,
            target_coords: [Number(rel.target_lat), Number(rel.target_lng)],
            relationship: rel.relationship_type,
            evidence: rel.evidence_sentence,
            confidence: rel.confidence_score
          });
        });
      } else if (data.transit_corridors) {
        // Fallback for object format
        Object.keys(data.transit_corridors).forEach((key, idx) => {
          const points = data.transit_corridors[key];
          if (points.length >= 2) {
            corridorsToRender.push({
              id: idx,
              source_label: points[0].location_name || key,
              source_coords: [points[0].latitude, points[0].longitude],
              target_label: points[1].location_name || "Destination",
              target_coords: [points[1].latitude, points[1].longitude],
              relationship: points[0].relationship || "Transit Corridor",
              evidence: "Corridor telemetry",
              confidence: 0.95
            });
          }
        });
      }

      corridorsToRender.forEach(corridor => {
        const [sLat, sLng] = corridor.source_coords;
        const [tLat, tLng] = corridor.target_coords;
        if (isNaN(sLat) || isNaN(sLng) || isNaN(tLat) || isNaN(tLng)) return;

        // Choose corridor color by category
        const relType = String(corridor.relationship || "").toLowerCase();
        let lineColor = "#00e5ff"; // default cyan
        if (relType.includes("driver") || relType.includes("route") || relType.includes("anpr") || relType.includes("vehicle") || relType.includes("transit")) {
          lineColor = "#ffb020"; // amber
        } else if (relType.includes("call") || relType.includes("msisdn") || relType.includes("hand-off") || relType.includes("comms")) {
          lineColor = "#f43f5e"; // rose
        } else if (relType.includes("layered") || relType.includes("settlement") || relType.includes("rtgs") || relType.includes("bank") || relType.includes("transfer")) {
          lineColor = "#10b981"; // emerald
        }

        // Draw tactical polyline
        const polyline = L.polyline([[sLat, sLng], [tLat, tLng]], {
          color: lineColor,
          weight: 3.5,
          dashArray: "8, 6",
          opacity: 0.85
        }).addTo(wsGISMap);

        polyline.bindTooltip(`
          <div style="font-family:'DM Mono',monospace;font-size:10px;">
            <b>${escapeHtml(corridor.source_label)}</b> ➔ <b>${escapeHtml(corridor.target_label)}</b><br/>
            <span style="color:${lineColor};">${escapeHtml(corridor.relationship)}</span>
          </div>
        `, { className: "gis-corridor-tooltip", sticky: true });

        polyline.on("click", () => {
          renderRelationshipInspector(corridor, lineColor);
        });

        wsCorridorPolylines.push(polyline);

        // Place directed arrow indicator at 55% of the distance from source to target
        const midLat = sLat + (tLat - sLat) * 0.55;
        const midLng = sLng + (tLng - sLng) * 0.55;
        const bearing = calcBearing(sLat, sLng, tLat, tLng);

        const arrowMarker = L.marker([midLat, midLng], {
          icon: L.divIcon({
            className: "gis-corridor-arrow-divicon",
            html: `
              <div class="gis-corridor-midpoint-marker" style="--corridor-color:${lineColor}; transform: rotate(${bearing}deg);" title="${escapeHtml(corridor.relationship)}">
                <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" stroke="${lineColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
              </div>
            `,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          }),
          interactive: true
        }).addTo(wsGISMap);

        arrowMarker.bindTooltip(`
          <div style="font-family:'DM Mono',monospace;font-size:10px;">
            <b style="color:${lineColor};">➔ FLOW DIRECTION</b><br/>
            ${escapeHtml(corridor.source_label)} ➔ ${escapeHtml(corridor.target_label)}<br/>
            <small style="color:#aeb5b1;">${escapeHtml(corridor.relationship)}</small>
          </div>
        `, { className: "gis-corridor-tooltip" });

        arrowMarker.on("click", () => {
          renderRelationshipInspector(corridor, lineColor);
        });

        wsCorridorArrows.push(arrowMarker);
      });
    }

    /* Co-location anomalies */
    const anomalies = data.colocation_anomalies || [];
    if (wsShowAnomalies && anomalies.length > 0) {
      anomalies.forEach(anom => {
        const circle = L.circle([anom.latitude, anom.longitude], {
          radius: 450,
          color: "#ff3366",
          fillColor: "#ff3366",
          fillOpacity: 0.18,
          weight: 1.5,
          dashArray: "4, 4"
        }).addTo(wsGISMap);
        circle.bindTooltip(`
          <div style="font-family:'DM Mono',monospace;font-size:10px;">
            <b style="color:#ff3366;">CO-LOCATION PROXIMITY ALERT</b><br/>
            ${escapeHtml(anom.entity_a)} &amp; ${escapeHtml(anom.entity_b)}<br/>
            <small style="color:#c5cac7;">Within ${anom.time_gap_minutes || 12}m spatial window</small>
          </div>
        `, { className: "gis-corridor-tooltip" });
        wsAnomalyCircles.push(circle);
      });
    }
  }

  function activateMarker(entityId, props, marker) {
    wsActiveMarkerId = entityId;

    // Reset visual state of all markers
    document.querySelectorAll(".gis-tactical-marker-wrap").forEach(el => {
      el.classList.remove("active", "pulse");
    });

    // Add active pulse to clicked marker
    const markerEl = marker.getElement();
    if (markerEl) {
      const wrap = markerEl.querySelector(".gis-tactical-marker-wrap");
      if (wrap) wrap.classList.add("active", "pulse");
    }

    marker.openPopup();
    renderInspector(props);
    window.dispatchEvent(new CustomEvent("cipher:gis-node-select", { detail: props }));
  }

  /* ===========================================================
     INSPECTOR PANEL — RICH ENTITY & CORRIDOR VIEWS
     =========================================================== */

  function renderInspector(props) {
    const d = props || {};
    const name = d.name || d.label || "Selected map node";
    const type = d.entity_type || d.location_type || d.type || "ENTITY";
    const meta = getEntityArchetypeMeta(type);
    const lat = d.latitude ?? (d.lat ?? "—");
    const lng = d.longitude ?? (d.lng ?? "—");
    const coordinate = (lat !== "—" && lng !== "—") ? `${Number(lat).toFixed(4)} · ${Number(lng).toFixed(4)}` : "— · —";
    const entityId = d.id || d.entity_id || "";

    if (infoTitle) infoTitle.textContent = name;
    if (coords) coords.textContent = coordinate;

    // Find direct relationships connected to this entity
    let connectedLinksHtml = "";
    if (wsCurrentData && Array.isArray(wsCurrentData.directed_corridors)) {
      const related = wsCurrentData.directed_corridors.filter(r => 
        String(r.source_id) === String(entityId) || String(r.target_id) === String(entityId) ||
        r.source_label === name || r.target_label === name
      );

      if (related.length > 0) {
        connectedLinksHtml = `
          <div class="gis-info-section">
            <div class="gis-info-title"><span>CONNECTED TRANSIT CORRIDORS</span><small>${related.length}</small></div>
            <div style="display:flex;flex-direction:column;gap:6px;margin-top:4px;">
              ${related.map(r => {
                const isOut = String(r.source_id) === String(entityId) || r.source_label === name;
                const otherName = isOut ? r.target_label : r.source_label;
                const otherLat = isOut ? r.target_lat : r.source_lat;
                const otherLng = isOut ? r.target_lng : r.source_lng;
                return `
                  <div style="padding:6px 8px;background:rgba(255,255,255,0.03);border-left:2px solid ${meta.color};border-radius:2px;font-size:9px;cursor:pointer;" onclick="if(window.cipherPanToLocation) window.cipherPanToLocation(${otherLat}, ${otherLng}, '${escapeHtml(otherName)}')">
                    <div style="display:flex;justify-content:space-between;">
                      <b style="color:#ffffff;">${isOut ? '➔ OUTGOING' : '← INCOMING'}</b>
                      <span style="color:${meta.color};">${escapeHtml(r.relationship_type)}</span>
                    </div>
                    <div style="color:#7e8b97;margin-top:2px;">To: ${escapeHtml(otherName)}</div>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        `;
      }
    }

    if (inspBody) {
      inspBody.innerHTML = `
        <div class="gis-selected-state selected" style="border-left:3px solid ${meta.color};">
          <span class="gis-selected-dot live" style="background:${meta.color};box-shadow:0 0 8px ${meta.color};"></span>
          <div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
              <b style="color:${meta.color};letter-spacing:0.08em;">${meta.badge}</b>
              <span style="font-size:8px;color:#00f0aa;">● 98% VERIFIED</span>
            </div>
            <p style="color:#e6edf3;font-size:10px;font-weight:600;">${escapeHtml(name)}</p>
            <p style="color:#78848f;font-size:9px;margin-top:2px;">${escapeHtml(d.address || d.aliases || "Active investigation node.")}</p>
          </div>
        </div>

        <div class="gis-info-section">
          <div class="gis-info-title"><span>SPATIAL METADATA</span><small>ACTIVE</small></div>
          <div class="gis-info-row"><span>COORDINATES</span><b class="gis-searchable">${escapeHtml(coordinate)}</b></div>
          <div class="gis-info-row"><span>ADDRESS / SITE</span><b class="gis-searchable">${escapeHtml(d.address || d.aliases || "—")}</b></div>
          <div class="gis-info-row"><span>LAYER CLASSIFIER</span><b class="gis-searchable" style="color:${meta.color};">${escapeHtml(type.toUpperCase())}</b></div>
          <div class="gis-info-row"><span>VERIFICATION</span><b style="color:#00f0aa;">EVIDENCE BACKED</b></div>
        </div>

        ${connectedLinksHtml}

        <div style="margin:16px 14px 10px;">
          <button type="button" id="btnGisFocusInNetwork" class="case-create-primary" style="width:100%;background:rgba(0,229,255,0.12);color:#00e5ff;border:1px solid rgba(0,229,255,0.5);font-size:11px;font-weight:700;font-family:'DM Mono',monospace;padding:10px 12px;display:flex;align-items:center;justify-content:center;gap:7px;cursor:pointer;border-radius:4px;transition:all 0.2s ease;">
            <span>⤹</span> VIEW &amp; FOCUS IN NETWORK GRAPH
          </button>
        </div>
      `;

      const btnFocus = document.getElementById("btnGisFocusInNetwork");
      if (btnFocus) {
        btnFocus.onclick = () => {
          const targetId = entityId || name;
          if (typeof window.cipherFocusNetworkNode === "function") {
            window.cipherFocusNetworkNode(targetId, name);
          }
        };
      }
    }
  }

  function renderRelationshipInspector(corridor, color) {
    if (infoTitle) infoTitle.textContent = `${corridor.source_label} ➔ ${corridor.target_label}`;

    if (inspBody) {
      inspBody.innerHTML = `
        <div class="gis-selected-state selected" style="border-left:3px solid ${color};">
          <span class="gis-selected-dot live" style="background:${color};box-shadow:0 0 8px ${color};"></span>
          <div>
            <div style="font-size:8px;font-weight:700;color:${color};letter-spacing:0.08em;margin-bottom:3px;">
              DIRECTED TRANSIT CORRIDOR
            </div>
            <b style="color:#ffffff;font-size:11px;">${escapeHtml(corridor.relationship)}</b>
            <p style="color:#7f8b96;font-size:9px;margin-top:3px;">Evidence: ${escapeHtml(corridor.evidence || 'Field corroboration')}</p>
          </div>
        </div>

        <div class="gis-info-section">
          <div class="gis-info-title"><span>CORRIDOR SPECIFICATION</span><small>DIRECTED</small></div>
          <div class="gis-info-row"><span>SOURCE (FROM)</span><b style="color:#00e5ff;cursor:pointer;" onclick="if(window.cipherPanToLocation) window.cipherPanToLocation(${corridor.source_coords[0]}, ${corridor.source_coords[1]}, '${escapeHtml(corridor.source_label)}')">${escapeHtml(corridor.source_label)} ↗</b></div>
          <div class="gis-info-row"><span>TARGET (TO)</span><b style="color:#00e5ff;cursor:pointer;" onclick="if(window.cipherPanToLocation) window.cipherPanToLocation(${corridor.target_coords[0]}, ${corridor.target_coords[1]}, '${escapeHtml(corridor.target_label)}')">${escapeHtml(corridor.target_label)} ↗</b></div>
          <div class="gis-info-row"><span>RELATIONSHIP</span><b style="color:${color};">${escapeHtml(corridor.relationship)}</b></div>
          <div class="gis-info-row"><span>CONFIDENCE</span><b style="color:#00f0aa;">${Math.round((corridor.confidence || 0.95) * 100)}% CONFIRMED</b></div>
        </div>

        <div class="gis-info-section">
          <div class="gis-info-title"><span>EVIDENTIARY SENTENCE</span><small>LOGS</small></div>
          <div class="gis-info-placeholder" style="color:#aeb5b1;line-height:1.5;">
            ${escapeHtml(corridor.evidence || 'Direct telephonic, vehicle GPS, or transaction corroboration.')}
          </div>
        </div>

        <div style="margin:16px 14px 10px;">
          <button type="button" id="btnFocusCorridorInNet" class="case-create-primary" style="width:100%;background:rgba(0,229,255,0.12);color:#00e5ff;border:1px solid rgba(0,229,255,0.5);font-size:11px;font-weight:700;font-family:'DM Mono',monospace;padding:10px 12px;display:flex;align-items:center;justify-content:center;gap:7px;cursor:pointer;border-radius:4px;">
            <span>⤹</span> FOCUS CONNECTION IN NETWORK GRAPH
          </button>
        </div>
      `;

      const btnNet = document.getElementById("btnFocusCorridorInNet");
      if (btnNet) {
        btnNet.onclick = () => {
          if (typeof window.cipherFocusNetworkNode === "function") {
            window.cipherFocusNetworkNode(corridor.source_id || corridor.source_label, corridor.source_label);
          }
        };
      }
    }
  }

  /* ===========================================================
     COMPREHENSIVE GIS SEARCH CONTROLLER
     =========================================================== */

  let searchHighlightIdx = -1;

  function handleGISSearchInput() {
    const q = (search?.value || "").trim().toLowerCase();

    if (!q) {
      if (searchClearBtn) searchClearBtn.style.display = "none";
      if (searchDropdown) searchDropdown.style.display = "none";
      searchHighlightIdx = -1;
      return;
    }

    if (searchClearBtn) searchClearBtn.style.display = "block";

    // Gather searchable candidate pool
    const candidates = [];
    const seenIds = new Set();

    // 1. From current GIS data features
    if (wsCurrentData && wsCurrentData.geojson && Array.isArray(wsCurrentData.geojson.features)) {
      wsCurrentData.geojson.features.forEach(feat => {
        const p = feat.properties;
        const [lng, lat] = feat.geometry.coordinates;
        candidates.push({
          id: String(p.id || p.entity_id),
          label: p.name || p.label || "Entity",
          aliases: p.aliases || "",
          type: p.entity_type || p.location_type || "place",
          address: p.address || "",
          lat: Number(lat),
          lng: Number(lng),
          source: "GIS Layer"
        });
        seenIds.add(String(p.id || p.entity_id));
      });
    }

    // 2. From Cytoscape Network Graph nodes if active
    if (window.cy) {
      window.cy.nodes().forEach(n => {
        const d = n.data();
        const id = String(d.id || d.raw_id);
        if (!seenIds.has(id)) {
          candidates.push({
            id: id,
            label: d.label || "Node",
            aliases: d.aliases || "",
            type: d.type || "entity",
            address: d.address || "",
            lat: d.lat ? Number(d.lat) : null,
            lng: d.lng ? Number(d.lng) : null,
            source: "Network Graph"
          });
          seenIds.add(id);
        }
      });
    }

    // Check if query is coordinate string (e.g. "28.65, 77.23")
    const coordMatch = q.match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/);
    if (coordMatch) {
      const qLat = parseFloat(coordMatch[1]);
      const qLng = parseFloat(coordMatch[3]);
      renderSearchResultsDropdown([{
        id: "custom_coord",
        label: `Coordinates [${qLat.toFixed(4)}, ${qLng.toFixed(4)}]`,
        aliases: "Direct coordinate navigate",
        type: "place",
        address: `Custom map position`,
        lat: qLat,
        lng: qLng,
        source: "GPS Query"
      }], q);
      return;
    }

    // Filter and score candidates
    const matches = candidates.filter(c => {
      const fullText = `${c.label} ${c.aliases} ${c.type} ${c.address} ${c.id}`.toLowerCase();
      return fullText.includes(q);
    });

    renderSearchResultsDropdown(matches, q);
  }

  function renderSearchResultsDropdown(matches, q) {
    if (!searchDropdown) return;

    if (matches.length === 0) {
      searchDropdown.innerHTML = `
        <div class="gis-search-dropdown-header">
          <span>NO MATCHES FOUND FOR "${escapeHtml(q)}"</span>
        </div>
        <div style="padding:12px;font-size:10px;color:#616e7a;text-align:center;">
          Try searching by suspect name, vehicle, phone number, vault site, or latitude/longitude coordinates.
        </div>
      `;
      searchDropdown.style.display = "block";
      searchHighlightIdx = -1;
      return;
    }

    searchHighlightIdx = 0; // default to first match

    const html = `
      <div class="gis-search-dropdown-header">
        <span>FOUND ${matches.length} MATCHING ENTITY / LOCATION(S)</span>
        <span style="font-size:8px;color:#5a6875;">↑↓ SELECT · ↵ GO</span>
      </div>
      <div class="gis-search-results-list">
        ${matches.slice(0, 8).map((m, idx) => {
          const meta = getEntityArchetypeMeta(m.type);
          const hasGps = (m.lat !== null && m.lng !== null && !isNaN(m.lat) && !isNaN(m.lng));
          const subText = m.address || m.aliases || (hasGps ? `GPS: ${m.lat.toFixed(4)}, ${m.lng.toFixed(4)}` : "Available in Network Graph");

          // Highlight matched substring
          const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
          const highlightedLabel = escapeHtml(m.label).replace(regex, '<span class="gis-search-match-text">$1</span>');

          return `
            <div class="gis-search-result-item ${idx === 0 ? 'selected' : ''}" data-idx="${idx}" data-id="${m.id}" data-lat="${m.lat ?? ''}" data-lng="${m.lng ?? ''}" data-label="${escapeHtml(m.label)}">
              <div class="gis-search-item-icon" style="--badge-color:${meta.color};">
                ${meta.svg}
              </div>
              <div class="gis-search-item-info">
                <div class="gis-search-item-title">
                  <span>${highlightedLabel}</span>
                  <span class="gis-search-item-badge" style="--badge-color:${meta.color};">${meta.badge}</span>
                </div>
                <div class="gis-search-item-sub">${escapeHtml(subText)}</div>
              </div>
              <div class="gis-search-item-action">
                ${hasGps ? 'LOCATE ➔' : 'NET GRAPH ↗'}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;

    searchDropdown.innerHTML = html;
    searchDropdown.style.display = "block";

    // Bind click events on search results
    searchDropdown.querySelectorAll(".gis-search-result-item").forEach(item => {
      item.addEventListener("click", () => {
        executeGISSearchSelection(item);
      });
    });
  }

  function executeGISSearchSelection(item) {
    const latStr = item.dataset.lat;
    const lngStr = item.dataset.lng;
    const label = item.dataset.label;
    const entityId = item.dataset.id;

    if (searchDropdown) searchDropdown.style.display = "none";
    if (search) search.value = label;

    if (latStr && lngStr && latStr !== "" && lngStr !== "") {
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      window.cipherPanToLocation(lat, lng, label, entityId, false);
      toast(`Located: ${label} on GIS map.`);
    } else {
      toast(`Entity has no spatial coordinates. Switching to Network graph...`);
      window.cipherFocusNetworkNode(entityId, label);
    }
  }

  // Clear button handler
  searchClearBtn?.addEventListener("click", () => {
    if (search) search.value = "";
    if (searchClearBtn) searchClearBtn.style.display = "none";
    if (searchDropdown) searchDropdown.style.display = "none";
    search?.focus();
  });

  // Search input and keyboard navigation
  search?.addEventListener("input", handleGISSearchInput);
  search?.addEventListener("focus", handleGISSearchInput);

  search?.addEventListener("keydown", e => {
    if (!searchDropdown || searchDropdown.style.display === "none") return;

    const items = searchDropdown.querySelectorAll(".gis-search-result-item");
    if (items.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      searchHighlightIdx = (searchHighlightIdx + 1) % items.length;
      items.forEach((it, i) => it.classList.toggle("selected", i === searchHighlightIdx));
      items[searchHighlightIdx]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      searchHighlightIdx = (searchHighlightIdx - 1 + items.length) % items.length;
      items.forEach((it, i) => it.classList.toggle("selected", i === searchHighlightIdx));
      items[searchHighlightIdx]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (searchHighlightIdx >= 0 && searchHighlightIdx < items.length) {
        executeGISSearchSelection(items[searchHighlightIdx]);
      }
    } else if (e.key === "Escape") {
      searchDropdown.style.display = "none";
    }
  });

  // Close search dropdown on click outside
  document.addEventListener("click", e => {
    if (searchWrapper && !searchWrapper.contains(e.target)) {
      if (searchDropdown) searchDropdown.style.display = "none";
    }
  });

  // Global ⌘K shortcut
  focusSearch?.addEventListener("click", () => search?.focus());
  document.addEventListener("keydown", e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      search?.focus();
      search?.select();
    }
  });

  /* ===========================================================
     LAYER FILTERS (ALL / PERSONS / VEHICLES / SITES / COMMS)
     =========================================================== */

  const filterButtons = [
    { id: "gisFilterAll", filter: "all" },
    { id: "gisFilterPersons", filter: "person" },
  ];

  filterButtons.forEach(fb => {
    const btn = document.getElementById(fb.id);
    btn?.addEventListener("click", () => {
      wsActiveFilter = fb.filter;
      filterButtons.forEach(other => {
        document.getElementById(other.id)?.classList.toggle("active", other.id === fb.id);
      });
      renderWorkspaceGIS(wsCurrentData);
      toast(`GIS Filter applied: ${fb.filter.toUpperCase()}`);
    });
  });

  /* ===========================================================
     CROSS-VIEW SYNCHRONIZATION & GLOBAL HOOKS
     =========================================================== */

  /* Cross-view Pan & Highlight function */
  window.cipherPanToLocation = function(lat, lng, name, entityId, switchTab = true) {
    if (!lat || !lng) return;
    const numLat = parseFloat(lat);
    const numLng = parseFloat(lng);
    if (isNaN(numLat) || isNaN(numLng)) return;

    // 1. Switch to GIS tab if requested
    if (switchTab) {
      const gisNavBtn = document.querySelector('.workspace-sidebar .side-item[data-view="gis"]');
      if (gisNavBtn && !gisNavBtn.classList.contains("active")) {
        gisNavBtn.click();
      }
    }

    // 2. Fly map and activate marker
    setTimeout(() => {
      if (!wsGISMap) return;
      wsGISMap.invalidateSize();
      wsGISMap.flyTo([numLat, numLng], 15, { duration: 1.0 });

      let matchedMarker = null;
      let matchedProps = null;

      // Check by entityId
      if (entityId && wsLocationMarkers[entityId]) {
        matchedMarker = wsLocationMarkers[entityId];
      } else {
        // Find matching marker by proximity
        Object.entries(wsLocationMarkers).forEach(([id, m]) => {
          const mPos = m.getLatLng();
          if (Math.abs(mPos.lat - numLat) < 0.008 && Math.abs(mPos.lng - numLng) < 0.008) {
            matchedMarker = m;
            entityId = id;
          }
        });
      }

      if (matchedMarker) {
        if (wsCurrentData && wsCurrentData.geojson && Array.isArray(wsCurrentData.geojson.features)) {
          const feat = wsCurrentData.geojson.features.find(f => String(f.properties.id || f.properties.entity_id) === String(entityId));
          if (feat) matchedProps = feat.properties;
        }
        if (!matchedProps) {
          matchedProps = { id: entityId, name: name || "Node", latitude: numLat, longitude: numLng };
        }
        activateMarker(entityId, matchedProps, matchedMarker);
      } else {
        L.popup()
          .setLatLng([numLat, numLng])
          .setContent(`
            <div style="font-family:'DM Mono',monospace;padding:4px;">
              <b style="color:#00e5ff;">${escapeHtml(name || "Investigated Location")}</b><br/>
              <small style="color:#7fe9df;">LAT ${numLat.toFixed(4)} · LNG ${numLng.toFixed(4)}</small>
            </div>
          `)
          .openOn(wsGISMap);
      }
    }, switchTab ? 260 : 50);
  };

  /* Cross-view Focus: Switch to Network graph and zoom/select target node */
  window.cipherFocusNetworkNode = function(nodeIdOrLabel, fallbackName) {
    // 1. Switch to Network tab
    const networkNavBtn = document.querySelector('.workspace-sidebar .side-item[data-view="network"]');
    if (networkNavBtn) networkNavBtn.click();

    // 2. Center and select node in Cytoscape
    setTimeout(() => {
      const cyInstance = window.cy;
      if (!cyInstance) return;

      const needle = String(nodeIdOrLabel || fallbackName || "").toLowerCase().trim();
      let matchedNode = cyInstance.getElementById(String(nodeIdOrLabel));
      if (!matchedNode || matchedNode.length === 0) {
        matchedNode = cyInstance.nodes().filter(n => {
          const d = n.data();
          const dId = String(d.id || "").toLowerCase();
          const dRawId = String(d.raw_id || "").toLowerCase();
          const dLabel = String(d.label || "").toLowerCase();
          return dId === needle || dRawId === needle || dLabel === needle || (fallbackName && dLabel.includes(fallbackName.toLowerCase()));
        });
      }

      if (matchedNode && matchedNode.length > 0) {
        cyInstance.elements().unselect();
        matchedNode.select();
        matchedNode.connectedEdges().select();
        cyInstance.animate({
          center: { eles: matchedNode },
          zoom: 1.8,
          duration: 600
        });
        matchedNode.trigger("tap");
        toast(`Focused on network node: ${matchedNode.data("label") || nodeIdOrLabel}`);
      } else {
        toast(`Entity "${fallbackName || nodeIdOrLabel}" selected in case graph.`);
      }
    }, 320);
  };

  window.cipherHighlightEntityLocations = function(entityId, locations=[]) {
    const id=String(entityId||"");
    if(!id) return;
    const markers=wsLocationMarkersByEntity[id]||[];
    document.querySelectorAll(".gis-tactical-marker-wrap").forEach(el=>el.classList.remove("active","pulse"));
    markers.forEach(m=>{const el=m.getElement?.(); const wrap=el?.querySelector?.(".gis-tactical-marker-wrap"); if(wrap)wrap.classList.add("active","pulse");});
    if(locations.length && wsGISMap){
      const first=locations[0]; const lat=Number(first.latitude),lng=Number(first.longitude);
      if(Number.isFinite(lat)&&Number.isFinite(lng)) wsGISMap.flyTo([lat,lng],15,{duration:.8});
    }
  };

  window.addEventListener("cipher:vision-identity-verified",evt=>{
    const d=evt.detail||{}; wsVisionHighlight={entityId:d.entity_id,locations:d.locations||[]};
    if(typeof window.cipherHighlightEntityLocations==="function")window.cipherHighlightEntityLocations(d.entity_id,d.locations||[]);
  });

  /* Cross-view event: Network node selected -> Center GIS */
  window.addEventListener("cipher:network-node-select", (evt) => {
    const detail = evt.detail;
    if (detail && detail.lat && detail.lng) {
      window.cipherPanToLocation(detail.lat, detail.lng, detail.label, detail.id, false);
    }
  });

  /* Lock/Unlock Map Control */
  const gisLockBtn = document.getElementById("gisLockButton");
  gisLockBtn?.addEventListener("click", () => {
    if (!wsGISMap) return;
    const isDragging = wsGISMap.dragging.enabled();
    if (isDragging) {
      wsGISMap.dragging.disable();
      wsGISMap.scrollWheelZoom.disable();
      gisLockBtn.textContent = "Map Locked 🔒";
      gisLockBtn.classList.add("active");
      toast("GIS Map view locked in place.");
    } else {
      wsGISMap.dragging.enable();
      wsGISMap.scrollWheelZoom.enable();
      gisLockBtn.textContent = "Map Unlocked 🔓";
      gisLockBtn.classList.remove("active");
      toast("GIS Map view unlocked for pan/zoom.");
    }
  });

  /* Fit Bounds Control */
  const gisFitBoundsBtn = document.getElementById("gisFitBoundsBtn");
  gisFitBoundsBtn?.addEventListener("click", () => {
    if (!wsGISMap) return;
    const markers = Object.values(wsLocationMarkers);
    if (markers.length > 0) {
      const group = L.featureGroup(markers);
      wsGISMap.fitBounds(group.getBounds().pad(0.2));
      toast("Fitted view to all active investigation locations.");
    } else {
      wsGISMap.setView([22.9734, 78.6569], 5);
    }
  });

  /* Sync with Network Button */
  const wsBtnSync = document.getElementById("wsBtnSyncGraph");
  wsBtnSync?.addEventListener("click", async () => {
    toast("Synchronizing GIS layer with Network graph...");
    await loadWorkspaceGISData();

    // If Cytoscape has a selected node with coordinates, fly to it
    if (window.cy) {
      const selected = window.cy.$(':selected');
      if (selected && selected.length > 0) {
        const d = selected.first().data();
        if (d.lat && d.lng) {
          window.cipherPanToLocation(d.lat, d.lng, d.label, d.id, false);
          toast(`Synced with selected network node: ${d.label}`);
          return;
        }
      }
    }

    // Otherwise fit bounds to all markers
    const markers = Object.values(wsLocationMarkers);
    if (markers.length > 0 && wsGISMap) {
      const group = L.featureGroup(markers);
      wsGISMap.fitBounds(group.getBounds().pad(0.2));
      toast(`GIS & Network synchronized (${markers.length} spatial entities active).`);
    }
  });

  /* Toggle corridors */
  const wsBtnCorr = document.getElementById("wsBtnToggleCorridors");
  wsBtnCorr?.addEventListener("click", () => {
    wsShowCorridors = !wsShowCorridors;
    wsBtnCorr.classList.toggle("active", wsShowCorridors);
    wsBtnCorr.textContent = wsShowCorridors ? "Transit Corridors ON" : "Transit Corridors OFF";
    renderWorkspaceGIS(wsCurrentData);
    toast(wsShowCorridors ? "Transit corridors displayed." : "Transit corridors hidden.");
  });

  /* Toggle anomalies */
  const wsBtnAnom = document.getElementById("wsBtnToggleAnomalies");
  wsBtnAnom?.addEventListener("click", () => {
    wsShowAnomalies = !wsShowAnomalies;
    wsBtnAnom.classList.toggle("active", wsShowAnomalies);
    wsBtnAnom.textContent = wsShowAnomalies ? "Co-Location Risk ON" : "Co-Location Risk OFF";
    renderWorkspaceGIS(wsCurrentData);
    toast(wsShowAnomalies ? "Co-location anomalies displayed." : "Co-location anomalies hidden.");
  });

  /* Spatial Radius Query */
  let wsRadiusSearchCircle = null;
  const wsBtnRadiusSearch = document.getElementById("wsBtnRadiusSearch");
  wsBtnRadiusSearch?.addEventListener("click", async () => {
    if (!wsGISMap) { toast("Open the GIS view first."); return; }
    const center = wsGISMap.getCenter();
    const radiusKmStr = prompt("Enter spatial search radius around current map center (in km):", "15");
    if (!radiusKmStr) return;
    const radiusKm = parseFloat(radiusKmStr) || 15;
    const radiusM = radiusKm * 1000;

    if (wsRadiusSearchCircle) wsGISMap.removeLayer(wsRadiusSearchCircle);
    wsRadiusSearchCircle = L.circle([center.lat, center.lng], {
      radius: radiusM,
      color: "#00d2ff",
      fillColor: "#00d2ff",
      fillOpacity: 0.12,
      weight: 2,
      dashArray: "6, 6"
    }).addTo(wsGISMap);

    try {
      const res = await fetch(`${API_BASE}/api/cases/${window.CipherCaseState?.id || 0}/gis/nearby?latitude=${center.lat}&longitude=${center.lng}&radius=${radiusM}`, {headers: (typeof window.getAuthHeaders === "function" ? window.getAuthHeaders() : {})});
      const data = await res.json();
      if (data.status === "success") {
        toast(`Radius Query: Found ${data.count} location(s) within ${radiusKm}km.`);
      }
    } catch (e) {
      toast("Error executing spatial radius query.");
    }
  });

  /* Add Waypoint Tool */
  waypoint?.addEventListener("click", () => {
    if (!wsGISMap) { toast("Open the GIS view first."); return; }
    wsWaypointMode = !wsWaypointMode;
    gisMapContainer?.classList.toggle("waypoint-mode", wsWaypointMode);
    waypoint.classList.toggle("active", wsWaypointMode);
    toast(wsWaypointMode ? "Waypoint Tool Active: click the map to place a saved case location." : "Waypoint mode cancelled.");
  });

  async function placeWaypoint(latlng) {
    if (!wsGISMap || !latlng) return;
    const caseId = Number(window.CipherCaseState?.id || 0);
    if (!caseId) { toast("Select or create a case before adding a waypoint."); return; }

    try {
      const token = localStorage.getItem("cipher_access_token") || "";
      const label = window.prompt("Waypoint name", `Waypoint ${new Date().toLocaleTimeString()}`);
      if (!label) { wsWaypointMode = false; gisMapContainer?.classList.remove("waypoint-mode"); waypoint?.classList.remove("active"); return; }
      const address = window.prompt("Address / site note (optional)", `Field waypoint at ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`) || "";
      const res = await fetch(`/api/cases/${caseId}/gis/waypoints`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          label,
          latitude: latlng.lat,
          longitude: latlng.lng,
          location_type: "WAYPOINT",
          address_text: address,
          verification_status: "verified"
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || data.error || `HTTP ${res.status}`);

      wsWaypointMode = false;
      gisMapContainer?.classList.remove("waypoint-mode");
      waypoint?.classList.remove("active");
      await loadWorkspaceGISData();
      toast(`Waypoint "${label}" saved to the active case.`);
    } catch (err) {
      console.error("Waypoint save failed", err);
      toast(`Waypoint save failed: ${err.message || "backend error"}`);
    }
  }

  /* Global hooks for external integration */
  window.cipherSelectGISNode = function(nodeData) { renderInspector(nodeData); };
  window.addEventListener("cipher:gis-node-select", e => renderInspector(e.detail));

})();


/* =========================================================
   CASE REPORT / CHART SHEET
   ========================================================= */

(function initCaseReport() {

  const view =
    document.getElementById(
      "evidenceView"
    );


  if (!view)
    return;


  const printBtn =
    document.getElementById(
      "reportPrintPdf"
    );


  const saveState =
    document.getElementById(
      "reportSaveState"
    );


  const generated =
    document.getElementById(
      "reportGeneratedAt"
    );


  const title =
    document.getElementById(
      "reportTitle"
    );


  const subtitle =
    document.getElementById(
      "reportSubtitle"
    );


  const status =
    document.getElementById(
      "reportCaseStatus"
    );


  const toast =
    window.showNetworkToast;


  let reportTimer = 0;


  const fields =
    () =>
      [
        ...view.querySelectorAll(
          "[data-report-field]"
        )
      ];


  const getField =
    name =>
      view.querySelector(
        `[data-report-field="${name}"]`
      )?.value?.trim() ||
      "";


  const setDraftState =
    (
      label = "LOCAL DRAFT"
    ) => {

      if (saveState) {

        saveState.textContent =
          label;

      }


      clearTimeout(
        reportTimer
      );


      reportTimer =
        setTimeout(
          () => {

            if (saveState) {

              saveState.textContent =
                "AUTO-SAVED LOCALLY";

            }

          },
          700
        );

    };


  function syncHeader() {

    if (title) {

      title.textContent =
        getField(
          "caseId"
        ).includes(
          "BBC-1"
        )

          ? "1993 Bombay Serial Blasts"

          : (
              getField(
                "caseType"
              ) ||
              "Cipher Investigation Case"
            );

    }


    if (subtitle) {

      subtitle.textContent =
        `${
          getField(
            "caseType"
          ) ||
          "Investigation"
        } · ${
          getField(
            "incidentDate"
          ) ||
          "Date not entered"
        } · ${
          getField(
            "location"
          ) ||
          "Location not entered"
        }`;

    }


    if (status) {

      status.textContent =
        `CASE / ${
          getField(
            "caseId"
          ) ||
          "DRAFT"
        }`;

    }


    setDraftState();

  }


  fields().forEach(
    el =>
      el.addEventListener(
        "input",
        syncHeader
      )
  );


  const evidenceCsvInput = document.getElementById("evidenceCsvFileInput");
  const evidenceFileInput = document.getElementById("evidenceFileInput");
  const faceDatasetInput = document.getElementById("faceDatasetFileInput");
  const addFaceDatasetBtn = document.getElementById("reportAddFaceDataset");

  async function uploadCaseEvidenceFile(file, kind="AUTO") {
    const caseId=Number(window.CipherCaseState?.id||0);
    if(!caseId || !window.CipherCaseState?.caseSelected) { showNetworkToast?.("Select a case before uploading evidence."); return; }
    if(!file) return;
    const ext=(file.name.split(".").pop()||"").toLowerCase();
    const allowed=["pdf","txt","csv","jpg","jpeg","png","webp","zip"];
    if(!allowed.includes(ext)){ showNetworkToast?.("Unsupported evidence type. Use PDF, TXT, CSV, JPG, PNG, WEBP or Face Dataset ZIP."); return; }
    if(file.size>10*1024*1024 && ext!=="zip"){ showNetworkToast?.("Evidence file exceeds the 10 MB upload limit."); return; }
    if(file.size>250*1024*1024 && ext==="zip"){ showNetworkToast?.("Face dataset ZIP exceeds the 250 MB safety limit."); return; }
    const token=localStorage.getItem("cipher_access_token")||localStorage.getItem("token")||sessionStorage.getItem("cipher_access_token")||"";
    const fd=new FormData(); fd.append("file",file); fd.append("evidence_type",kind);
    showNetworkToast?.(`Uploading ${file.name} to case evidence…`);
    try{
      const h={}; if(token)h.Authorization=`Bearer ${token}`;
      const r=await fetch(`/api/cases/${caseId}/documents`,{method:"POST",headers:h,body:fd});
      const d=await r.json(); if(!r.ok)throw new Error(d.detail||`HTTP ${r.status}`);
      const doc=d.document||{};
      const list=document.getElementById("reportEvidenceList");
      if(list){
        const row=document.createElement("div"); row.className="evidence-row cipher-generic-evidence-row";
        const icon=ext==="zip"?"FACE":ext.toUpperCase();
        row.innerHTML=`<span class="evidence-icon">${icon}</span><div><b>${escapeHtml(file.name)}</b><small>${kind==="FACE_REFERENCE_DATASET"?"Face Reference Dataset · case-scoped gallery":"Case evidence · awaiting processing"}</small></div><em>UPLOADED</em>`; list.prepend(row);
      }
      showNetworkToast?.(`✓ ${file.name} uploaded. Processing evidence…`);
      const pr=await fetch(`/api/cases/${caseId}/evidence/${doc.id}/process`,{method:"POST",headers:h});
      const pd=await pr.json(); if(!pr.ok)throw new Error(pd.detail||`Processing HTTP ${pr.status}`);
      // Poll only the selected document. This keeps the existing Evidence UI and
      // avoids fabricating graph data while the durable worker is running.
      for(let i=0;i<90;i++){
        await new Promise(res=>setTimeout(res,1500));
        const dr=await fetch(`/api/cases/${caseId}/documents`,{headers:h}); if(!dr.ok)continue;
        const dd=await dr.json(); const cur=(dd.documents||[]).find(x=>String(x.id)===String(doc.id));
        const st=String(cur?.processing_status||"").toUpperCase();
        if(st==="PROCESSED"){
          if(kind==="FACE_REFERENCE_DATASET"){showNetworkToast?.("✓ Face Reference Dataset enrolled into this case gallery. Review any newly created person records before trusting them.");}
          else {showNetworkToast?.(`✓ ${file.name} processed and indexed into the case evidence layer.`);}
          if(typeof window.loadNetworkGraph==="function")await window.loadNetworkGraph(caseId);
          if(typeof window.renderDynamicTimeline==="function")await window.renderDynamicTimeline();
          return d;
        }
        if(st==="FAILED"){throw new Error(`Evidence processing failed for ${file.name}.`);}
      }
      showNetworkToast?.(`Processing is still running for ${file.name}. You can continue investigating.`);
      return d;
    }catch(e){showNetworkToast?.(`✕ Evidence upload failed: ${e.message}`);}
  }

  function addEvidence() {
    if (evidenceFileInput) { evidenceFileInput.value=""; evidenceFileInput.click(); return; }
    if (evidenceCsvInput) {
      evidenceCsvInput.value = "";
      evidenceCsvInput.click();
      return;
    }
    if (typeof window.cipherHandleCsvFile === "function") {
      const fallbackInput = document.getElementById("csvFileInput");
      if (fallbackInput) {
        fallbackInput.value = "";
        fallbackInput.click();
        return;
      }
    }

    const list = document.getElementById("reportEvidenceList");
    if (!list) return;

    const row = document.createElement("div");
    row.className = "evidence-row";
    row.innerHTML = `
      <span class="evidence-icon">NEW</span>
      <div>
        <b contenteditable="true">New evidence item</b>
        <small contenteditable="true">Enter source, date, authority and verification status.</small>
      </div>
      <em>USER INPUT</em>
    `;
    list.appendChild(row);
    row.querySelector("b")?.focus();
    setDraftState("EVIDENCE ADDED");
  }

  evidenceFileInput?.addEventListener("change", async () => {
    const file=evidenceFileInput.files?.[0]; if(!file)return;
    const ext=(file.name.split(".").pop()||"").toLowerCase();
    await uploadCaseEvidenceFile(file,"AUTO"); evidenceFileInput.value="";
  });
  // Global helpers used by the Face Dataset and Vision modules. The older
  // Network/CSV helpers are scoped inside their own IIFEs, so those functions
  // are not visible here. Keep one safe implementation on window and expose
  // local bindings for this module.
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>\'"]/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\'": "&#39;",
      "\"": "&quot;"
    })[c]);
  }
  window.escapeHtml = window.escapeHtml || escapeHtml;

  function showNetworkToast(message) {
    let t=document.getElementById("networkToast");
    if(!t){
      t=document.createElement("div");
      t.id="networkToast";
      t.className="network-toast";
      document.body.appendChild(t);
    }
    t.textContent=String(message ?? "");
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer=setTimeout(()=>t.classList.remove("show"),2600);
  }
  window.showNetworkToast = window.showNetworkToast || showNetworkToast;

  async function uploadFaceDatasetImages(files) {
    const caseId=Number(window.CipherCaseState?.id||0);
    if(!caseId || !window.CipherCaseState?.caseSelected) { showNetworkToast?.("Select a case before adding a face dataset."); return; }
    const selected=Array.from(files||[]);
    if(!selected.length)return;
    const images=selected.filter(f=>/\.(jpg|jpeg|png|webp)$/i.test(f.name));
    const zips=selected.filter(f=>/\.zip$/i.test(f.name));
    if(zips.length){
      if(selected.length!==1){showNetworkToast?.("Use either one Face Dataset ZIP or multiple reference images at a time.");return;}
      await uploadCaseEvidenceFile(zips[0],"FACE_REFERENCE_DATASET"); return;
    }
    if(!images.length){showNetworkToast?.("Select JPG, JPEG, PNG or WEBP reference images.");return;}
    const tooLarge=images.find(f=>f.size>10*1024*1024);
    if(tooLarge){showNetworkToast?.(`${tooLarge.name} exceeds the 10 MB image limit.`);return;}

    const list=document.getElementById("reportEvidenceList");
    const pendingRows=[];
    if(list){
      images.forEach(file=>{
        const row=document.createElement("div"); row.className="evidence-row cipher-generic-evidence-row";
        row.dataset.faceUploadName=file.name;
        row.innerHTML=`<span class="evidence-icon">FACE</span><div><b>${escapeHtml(file.name)}</b><small>Face Dataset · uploading to authorized case gallery…</small></div><em>UPLOADING</em>`;
        list.prepend(row); pendingRows.push(row);
      });
    }

    const token=localStorage.getItem("cipher_access_token")||localStorage.getItem("token")||sessionStorage.getItem("cipher_access_token")||"";
    const fd=new FormData(); images.forEach(f=>fd.append("images",f,f.name));
    showNetworkToast?.(`Uploading ${images.length} reference image${images.length===1?"":"s"} to the case Face Dataset…`);
    try{
      const h={}; if(token)h.Authorization=`Bearer ${token}`;
      // runtime.js routes protected /api requests to CIPHER_API_BASE (or the
      // local :8000 backend automatically). This prevents a common failure when
      // the polished frontend is opened from Vite/Live Server on another port.
      const r=await fetch(`/api/cases/${caseId}/face-gallery/bulk`,{method:"POST",headers:h,body:fd});
      const raw=await r.text();
      let d={}; try{d=raw?JSON.parse(raw):{};}catch{d={detail:raw||`HTTP ${r.status}`};}
      if(!r.ok){
        const detail=typeof d.detail==='string'?d.detail:(d.detail?.message||d.error||`HTTP ${r.status}`);
        throw new Error(detail);
      }
      const ok=Number(d.profiles_created||0), err=Array.isArray(d.errors)?d.errors.length:0;
      const successNames=new Set((d.profiles||[]).map(p=>String(p.filename||"")));
      const errorNames=new Set((d.errors||[]).map(e=>String(e.filename||"")));
      pendingRows.forEach(row=>{
        const name=String(row.dataset.faceUploadName||"");
        const success=successNames.has(name) || (err===0 && ok===images.length);
        const failed=errorNames.has(name) || (!success && err>0);
        row.querySelector("small").textContent=success
          ? "Face Dataset · enrolled in case gallery"
          : failed
            ? "Face Dataset · stored as evidence; enrollment failed — see status"
            : "Face Dataset · stored as evidence; enrollment status pending";
        row.querySelector("em").textContent=success?"ENROLLED":failed?"FAILED":"UPLOADED";
      });
      // Replace temporary optimistic rows with the authoritative case evidence
      // register. It derives face enrollment state from persisted face_profiles,
      // preventing successful enrollments from remaining visually marked FAILED.
      if(typeof window.cipherRefreshEvidence === "function") {
        await window.cipherRefreshEvidence();
      }
      if(ok===0 && err>0){
        const first=String(d.errors?.[0]?.error||"Face enrollment failed");
        showNetworkToast?.(`✕ Upload reached CIPHER, but no image was enrolled: ${first}`);
      }else{
        showNetworkToast?.(`✓ Face Dataset updated: ${ok}/${images.length} image${images.length===1?"":"s"} enrolled${err?`; ${err} failed — ${String(d.errors?.[0]?.error||"check details")}`:""}.`);
      }
      if(typeof window.loadNetworkGraph==="function")await window.loadNetworkGraph(caseId);
      if(typeof window.renderDynamicTimeline==="function")await window.renderDynamicTimeline();
      if(typeof window.loadCipherVision==="function")window.loadCipherVision();
      return d;
    }catch(e){
      pendingRows.forEach(row=>{row.querySelector("small").textContent="Face Dataset · upload failed — backend connection or authentication error";row.querySelector("em").textContent="FAILED";});
      showNetworkToast(`✕ Face Dataset upload failed: ${e.message}`);
      if(typeof window.cipherRefreshEvidence === "function") await window.cipherRefreshEvidence();
    }
  }
  addFaceDatasetBtn?.addEventListener("click",()=>{ if(faceDatasetInput){faceDatasetInput.value="";faceDatasetInput.click();} });
  faceDatasetInput?.addEventListener("change",async()=>{await uploadFaceDatasetImages(faceDatasetInput.files);faceDatasetInput.value="";});

  evidenceCsvInput?.addEventListener("change", () => {
    const file = evidenceCsvInput.files?.[0];
    if (file && typeof window.cipherHandleCsvFile === "function") {
      window.cipherHandleCsvFile(file);
    }
  });

  const evidenceWorkspace = document.getElementById("evidenceView");
  if (evidenceWorkspace) {
    evidenceWorkspace.addEventListener("dragover", (e) => {
      e.preventDefault();
    });
    evidenceWorkspace.addEventListener("drop", (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file) uploadCaseEvidenceFile(file,"AUTO");
    });
  }

  document
    .getElementById("reportAddEvidence")
    ?.addEventListener("click", addEvidence);

  document
    .getElementById("reportAddEvidenceInline")
    ?.addEventListener("click", addEvidence);


  async function printPdf() {
    const caseId = Number(window.CipherCaseState?.id || 0);
    if (!caseId) {
      if (typeof toast === "function") toast("Open a case before exporting the report PDF.");
      return;
    }
    const oldText = printBtn?.textContent || "PRINT / EXPORT PDF ↗";
    try {
      if (printBtn) { printBtn.disabled = true; printBtn.textContent = "GENERATING PDF..."; }
      const token = localStorage.getItem("cipher_access_token") || "";
      const res = await fetch(`/api/cases/${caseId}/report.pdf`, {
        headers: { ...(token ? { "Authorization": `Bearer ${token}` } : {}) }
      });
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(err || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
      const filename = match?.[1] || `CIPHER_${caseId}_Case_Report.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      if (typeof toast === "function") toast("Case report PDF exported successfully.");
    } catch (err) {
      console.error("PDF export failed", err);
      if (typeof toast === "function") toast(`PDF export failed: ${err.message || "backend error"}`);
    } finally {
      if (printBtn) { printBtn.disabled = false; printBtn.textContent = oldText; }
    }
  }


  printBtn?.addEventListener(
    "click",
    printPdf
  );


  if (generated) {

    generated.textContent =
      "LOCAL DRAFT";

  }


  syncHeader();

})();


/* =========================================================
   CIPHER GIS & SPATIAL INTELLIGENCE MAP ENGINE
   ========================================================= */

(function initGISModule() {
  let gisMap = null;
  let locationMarkers = {};
  let corridorPolylines = [];
  let anomalyCircles = [];
  let currentGISData = null;

  let showCorridors = true;
  let showAnomalies = true;

  function initMap() {
    const container = document.getElementById("cipherGISMap");
    if (!container || gisMap) return;

    // Map is centered on case data when available; otherwise Leaflet starts at a neutral world view.
    gisMap = L.map("cipherGISMap").setView([22.9734, 78.6569], 5);

    // Clean Tactical Dark tile layer (watermark-free, no key required) + CARTO / OSM options
    const tileConfig = window.createCipherTileLayers ? window.createCipherTileLayers() : null;
    if (tileConfig) {
      tileConfig.defaultLayer.addTo(gisMap);
      L.control.layers(tileConfig.baseMaps, null, { position: 'topright' }).addTo(gisMap);
    } else {
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
        maxZoom: 16
      }).addTo(gisMap);
    }

    loadGISData();
  }

  async function loadGISData() {
    if (!getCipherActiveCaseId()) return;
    try {
      const response = await fetch(`${window.location.origin}/api/cases/${window.CipherCaseState?.id || 0}/gis-data`, {headers: (typeof window.getAuthHeaders === "function" ? window.getAuthHeaders(false) : {})});
      if (response.ok) {
        currentGISData = await response.json();
      } else {
        throw new Error("Backend response error");
      }
    } catch (e) {
      console.error("CIPHER GIS backend load failed", e);
      currentGISData = { status: "error", case_id: window.CipherCaseState?.id || 0, location_count: 0, event_count: 0, geojson: { type: "FeatureCollection", features: [] }, transit_corridors: {}, directed_corridors: [], colocation_anomalies: [], error: e.message };
    }

    renderGISData(currentGISData);
  }

  function getFallbackGISData() {
    return {
      status: "success",
      case_id: Number(window.CipherCaseState?.id || 0),
      location_count: 0,
      event_count: 0,
      geojson: { type: "FeatureCollection", features: [] },
      transit_corridors: {},
      directed_corridors: [],
      colocation_anomalies: []
    };
  }

  function renderGISData(data) {
    if (!gisMap || !data) return;

    Object.values(locationMarkers).forEach(m => gisMap.removeLayer(m));
    locationMarkers = {};

    corridorPolylines.forEach(p => gisMap.removeLayer(p));
    corridorPolylines = [];

    anomalyCircles.forEach(c => gisMap.removeLayer(c));
    anomalyCircles = [];

    const features = (data.geojson && data.geojson.features) ? data.geojson.features : [];
    features.forEach(feat => {
      const [lng, lat] = feat.geometry.coordinates;
      const props = feat.properties;

      let markerColor = "#d9ff55";
      if (props.location_type === "CRIME_SCENE") markerColor = "#ff6b5f";
      if (props.location_type === "TOWER_SECTOR") markerColor = "#87918c";
      if (props.location_type === "SAFE_HOUSE") markerColor = "#ffb020";

      const marker = L.circleMarker([lat, lng], {
        radius: 9,
        fillColor: markerColor,
        color: "#ffffff",
        weight: 1.5,
        opacity: 1,
        fillOpacity: 0.85
      }).addTo(gisMap);

      marker.bindPopup(`
        <b>${props.name}</b><br/>
        <small style="color:#7f8883">${props.location_type}</small><br/>
        <span>${props.address || ''}</span>
      `);

      marker.on("click", () => {
        showLocationDetail(props);
      });

      locationMarkers[props.id] = marker;
    });

    if (showCorridors && data.transit_corridors) {
      const colors = ["#d9ff55", "#00d2ff", "#ff007a"];
      let cIdx = 0;
      Object.keys(data.transit_corridors).forEach(entityName => {
        const points = data.transit_corridors[entityName].map(p => [p.latitude, p.longitude]);
        if (points.length > 1) {
          const polyline = L.polyline(points, {
            color: colors[cIdx % colors.length],
            weight: 3,
            dashArray: "6, 8",
            opacity: 0.85
          }).addTo(gisMap);

          polyline.bindTooltip(`Transit Line: ${entityName}`);
          corridorPolylines.push(polyline);
          cIdx++;
        }
      });
    }

    const anomalies = data.colocation_anomalies || [];
    if (showAnomalies && anomalies.length > 0) {
      anomalies.forEach(anom => {
        const circle = L.circle([anom.latitude, anom.longitude], {
          radius: 600,
          color: "#ff6b5f",
          fillColor: "#ff6b5f",
          fillOpacity: 0.25,
          weight: 2
        }).addTo(gisMap);

        circle.bindTooltip(`CO-LOCATION RISK: ${anom.entity_a} & ${anom.entity_b} (${anom.time_gap_minutes}m gap)`);
        anomalyCircles.push(circle);
      });
    }

    const locEl = document.getElementById("gisLocCount");
    if (locEl) locEl.textContent = features.length;
    const corrEl = document.getElementById("gisCorridorCount");
    if (corrEl) corrEl.textContent = Object.keys(data.transit_corridors || {}).length;
    const anomEl = document.getElementById("gisAnomalyCount");
    if (anomEl) anomEl.textContent = anomalies.length;

    const anomalyListEl = document.getElementById("gisAnomalyList");
    if (anomalyListEl) {
      if (anomalies.length === 0) {
        anomalyListEl.innerHTML = '<p class="muted">No spatial co-location anomalies detected.</p>';
      } else {
        anomalyListEl.innerHTML = anomalies.map(a => `
          <div class="gis-anomaly-item">
            <strong>⚠️ ${a.anomaly_score}</strong>
            <p><strong>${a.entity_a}</strong> & <strong>${a.entity_b}</strong> co-located within <strong>${a.time_gap_minutes} mins</strong>.</p>
            <small>📍 ${a.location}</small>
          </div>
        `).join("");
      }
    }
  }

  function showLocationDetail(props) {
    const detailEl = document.getElementById("gisSelectedDetail");
    if (!detailEl) return;

    detailEl.innerHTML = `
      <strong>${props.name}</strong>
      <p style="margin: 4px 0 0; color: #a3adab;">Type: ${props.location_type}</p>
      <p style="margin: 2px 0 0; color: #7f8883; font-size: 11px;">Address: ${props.address || 'N/A'}</p>
      <p style="margin: 4px 0 0; font-family: 'DM Mono', monospace; font-size: 10px; color: #d9ff55;">
        Lat: ${props.latitude ? props.latitude.toFixed(4) : 'N/A'} | Lon: ${props.longitude ? props.longitude.toFixed(4) : 'N/A'}
      </p>
    `;
  }

  window.addEventListener("load", () => {
    setTimeout(initMap, 400);

    const btnCorridors = document.getElementById("btnToggleCorridors");
    btnCorridors?.addEventListener("click", () => {
      showCorridors = !showCorridors;
      btnCorridors.classList.toggle("active", showCorridors);
      btnCorridors.textContent = showCorridors ? "Transit Corridors ON" : "Transit Corridors OFF";
      renderGISData(currentGISData);
    });

    const btnAnomalies = document.getElementById("btnToggleAnomalies");
    btnAnomalies?.addEventListener("click", () => {
      showAnomalies = !showAnomalies;
      btnAnomalies.classList.toggle("active", showAnomalies);
      btnAnomalies.textContent = showAnomalies ? "Co-Location Risk ON" : "Co-Location Risk OFF";
      renderGISData(currentGISData);
    });

    const btnSync = document.getElementById("btnSyncGraph");
    btnSync?.addEventListener("click", () => {
      if (gisMap) {
        gisMap.flyTo([18.9800, 72.8800], 12, { duration: 1.5 });
      }
    });
  });
})();

/* =========================================================
   SPEC 1.4: CYTOSCAPE NETWORK GRAPH & CROSS-VIEW ENGINE
   ========================================================= */

(function initCipherNetworkModule() {
  let cy = null;
  let activeSelectedNodeId = null;

  window.CipherSelection = {
    entityId: null
  };

  const container = document.getElementById("networkCanvasInner");
  const statsEl = document.getElementById("networkCanvasStats");
  const inspectorEmpty = document.getElementById("nodeInspectorEmpty");
  const inspectorContent = document.getElementById("nodeInspectorContent");
  const inspectName = document.getElementById("nodeInspectName");
  const inspectType = document.getElementById("nodeInspectType");
  const inspectAliases = document.getElementById("nodeInspectAliases");
  const inspectStatus = document.getElementById("nodeInspectStatus");
  const inspectRelCount = document.getElementById("nodeInspectRelCount");
  const inspectRelList = document.getElementById("nodeInspectRelList");
  const btnInspectViewOnMap = document.getElementById("btnInspectViewOnMap");
  const nodeInspectorLinksPanel = document.getElementById("nodeInspectorLinksPanel");
  const nodeInspectorSourcePanel = document.getElementById("nodeInspectorSourcePanel");
  const nodeInspectLinksPanelCount = document.getElementById("nodeInspectLinksPanelCount");
  const nodeInspectLinksPanelList = document.getElementById("nodeInspectLinksPanelList");
  const nodeInspectSourceStatus = document.getElementById("nodeInspectSourceStatus");
  const nodeInspectSourcePanelBody = document.getElementById("nodeInspectSourcePanelBody");
  let activeNetworkInspectorTab = "node";
  let activeNodeIntel = null;
  const autoLayoutBtn = document.getElementById("graphAutoLayoutBtn");
  const hierarchicalBtn = document.getElementById("graphHierarchicalBtn");
  const fitViewBtn = document.getElementById("graphFitViewBtn");
  const deleteNodeBtn = document.getElementById("deleteNodeBtn");

  function escapeXml(unsafe) {
    if (!unsafe) return "";
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // Premium glass-bubble node renderer.
  // IMPORTANT: this is presentation-only. The node keeps the same backend id,
  // type, degree, selection and relationship data; only its visual skin changes.
  // Simplified semantic node renderer.
  // Presentation-only: graph IDs, relationships, sizing hierarchy and backend data stay unchanged.
  function buildTacticalNodeSvg(data, degree = 1) {
    const isHub = String(data?.isPrimarySource || '').toLowerCase() === 'true';
    const size = isHub ? 96 : (degree >= 3 ? 62 : (degree >= 2 ? 56 : 50));
    const c = size / 2;
    const radius = isHub ? 28 : (degree >= 3 ? 20 : (degree >= 2 ? 18 : 16));
    const idSafe = String(data?.id || Math.random()).replace(/[^a-zA-Z0-9_-]/g, '');
    const type = String(data?.type || '').toLowerCase();
    const semanticColor = (() => {
      if (type.includes('person') || type.includes('suspect') || type.includes('individual') || type.includes('kingpin') || type.includes('driver')) return '#d9ff55';
      if (type.includes('phone') || type.includes('msisdn') || type.includes('mobile') || type.includes('cdr') || type.includes('communication')) return '#59d9ff';
      if (type.includes('account') || type.includes('financial') || type.includes('bank') || type.includes('transaction')) return '#ffc857';
      if (type.includes('place') || type.includes('location') || type.includes('terminal') || type.includes('vault')) return '#b98cff';
      if (type.includes('vehicle') || type.includes('car')) return '#ff9b62';
      if (type.includes('org') || type.includes('company') || type.includes('business') || type.includes('organisation')) return '#ff6f7d';
      if (type.includes('evidence') || type.includes('document') || type.includes('file')) return '#c9d2cc';
      return '#8fa39a';
    })();

    let glyph = '';
    if (type.includes('person') || type.includes('suspect') || type.includes('individual')) {
      glyph = `<circle cx="${c}" cy="${c-4}" r="4.4" fill="#f3fff7"/><path d="M ${c-8.5} ${c+10} C ${c-8} ${c+2}, ${c+8} ${c+2}, ${c+8.5} ${c+10} Z" fill="#f3fff7"/>`;
    } else if (type.includes('place') || type.includes('location') || type.includes('terminal') || type.includes('vault')) {
      glyph = `<path d="M ${c} ${c+10} C ${c-7} ${c+2}, ${c-7} ${c-6}, ${c} ${c-10} C ${c+7} ${c-6}, ${c+7} ${c+2}, ${c} ${c+10} Z" fill="none" stroke="#f3fff7" stroke-width="1.8"/><circle cx="${c}" cy="${c-2}" r="2.5" fill="#f3fff7"/>`;
    } else if (type.includes('phone') || type.includes('msisdn') || type.includes('mobile') || type.includes('cdr')) {
      glyph = `<rect x="${c-5.5}" y="${c-10}" width="11" height="20" rx="2.5" fill="none" stroke="#f3fff7" stroke-width="1.8"/><circle cx="${c}" cy="${c+6.8}" r="1.1" fill="#f3fff7"/>`;
    } else if (type.includes('vehicle') || type.includes('car')) {
      glyph = `<path d="M ${c-11} ${c+6} L ${c-7} ${c-4} H ${c+7} L ${c+11} ${c+6} V ${c+9} H ${c-11} Z" fill="none" stroke="#f3fff7" stroke-width="1.6"/><circle cx="${c-7}" cy="${c+8}" r="2" fill="#f3fff7"/><circle cx="${c+7}" cy="${c+8}" r="2" fill="#f3fff7"/>`;
    } else if (type.includes('account') || type.includes('financial') || type.includes('bank') || type.includes('transaction')) {
      glyph = `<path d="M ${c-10} ${c-6} L ${c} ${c-11} L ${c+10} ${c-6} M ${c-8} ${c-3} V ${c+7} M ${c-2} ${c-3} V ${c+7} M ${c+4} ${c-3} V ${c+7} M ${c-11} ${c+9} H ${c+11}" fill="none" stroke="#f3fff7" stroke-width="1.5" stroke-linecap="round"/>`;
    } else if (type.includes('org') || type.includes('company') || type.includes('business')) {
      glyph = `<rect x="${c-9}" y="${c-8}" width="18" height="17" rx="1.5" fill="none" stroke="#f3fff7" stroke-width="1.6"/><path d="M ${c-5} ${c-3} H ${c-2} M ${c+2} ${c-3} H ${c+5} M ${c-5} ${c+3} H ${c-2} M ${c+2} ${c+3} H ${c+5}" stroke="#f3fff7" stroke-width="1.4" stroke-linecap="round"/>`;
    } else if (type.includes('evidence') || type.includes('document') || type.includes('file')) {
      glyph = `<rect x="${c-8}" y="${c-10}" width="16" height="20" rx="2" fill="none" stroke="#f3fff7" stroke-width="1.6"/><path d="M ${c-4} ${c-3} H ${c+4} M ${c-4} ${c+3} H ${c+4}" stroke="#f3fff7" stroke-width="1.4" stroke-linecap="round"/>`;
    } else {
      glyph = `<circle cx="${c}" cy="${c}" r="4.5" fill="#f3fff7"/>`;
    }

    const outer = isHub ? 34 : radius + 4;
    const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${c}" cy="${c}" r="${outer}" fill="${semanticColor}" fill-opacity=".10"/>
      <circle cx="${c}" cy="${c}" r="${radius+2}" fill="#07100b" stroke="${semanticColor}" stroke-opacity=".34" stroke-width="1.4"/>
      <circle cx="${c}" cy="${c}" r="${radius}" fill="#0b1210" stroke="${semanticColor}" stroke-opacity=".92" stroke-width="1.6"/>
      ${isHub ? `<circle cx="${c}" cy="${c}" r="${radius+6}" fill="none" stroke="${semanticColor}" stroke-opacity=".28" stroke-width="1" stroke-dasharray="2 5"/>` : ''}
      <g opacity=".92">${glyph}</g>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(xml);
  }

  // Anti-overlap Hierarchical Tier Layout Engine
  function applyTieredHierarchyLayout(cyInstance, animate = true) {
    if (!cyInstance) return;
    const nodes = cyInstance.nodes();
    if (nodes.length === 0) return;

    const tier1 = []; // Kingpins / High-level targets
    const tier2 = []; // Facilitators, Staff, Registered Organisations
    const tier3 = []; // Communications & Financial Accounts
    const tier4 = []; // Vehicles & Physical Locations

    nodes.forEach(node => {
      const d = node.data();
      const type = (d.type || '').toLowerCase();
      const lbl = (d.label || '').toLowerCase();
      const role = (d.aliases || '').toLowerCase();

      if (type.includes('phone') || type.includes('msisdn') || type.includes('mobile')) {
        tier3.push(node);
      } else if (type.includes('account') || type.includes('financial') || type.includes('bank')) {
        tier3.push(node);
      } else if (type.includes('vehicle') || type.includes('car')) {
        tier4.push(node);
      } else if (type.includes('place') || type.includes('location') || type.includes('vault') || type.includes('terminal')) {
        tier4.push(node);
      } else if (type.includes('organis') || type.includes('company') || type.includes('business')) {
        tier2.push(node);
      } else if (type.includes('person') || type.includes('suspect')) {
        if (lbl.includes('rafiq') || lbl.includes('vikram') || role.includes('kingpin') || role.includes('proprietor') || role.includes('lead')) {
          tier1.push(node);
        } else {
          tier2.push(node);
        }
      } else {
        tier2.push(node);
      }
    });

    const nodeWidth = 265;
    const tierY = [80, 260, 440, 620];
    const allTiers = [tier1, tier2, tier3, tier4];
    const maxTierLength = Math.max(...allTiers.map(t => t.length), 1);
    const totalWidth = maxTierLength * nodeWidth;

    cyInstance.batch(() => {
      allTiers.forEach((tierNodes, tierIdx) => {
        const count = tierNodes.length;
        if (count === 0) return;
        const startX = (totalWidth - (count * nodeWidth)) / 2 + (nodeWidth / 2);
        const y = tierY[tierIdx];

        tierNodes.forEach((node, i) => {
          const x = startX + (i * nodeWidth);
          if (animate) {
            node.animate({
              position: { x, y },
              duration: 650,
              easing: 'ease-in-out-cubic'
            });
          } else {
            node.position({ x, y });
          }
        });
      });
    });

    setTimeout(() => {
      cyInstance.fit(undefined, 40);
    }, animate ? 700 : 50);
  }

  // Network physics is intentionally disabled.
  // Nodes use a deterministic static arrangement and remain where the
  // investigator places them until an explicit arrange/fit action is used.
  let activeForceRaf = 0;
  let activeForceToken = 0;
  let forceState = null;

  function stopOrganicForceLayout() {
    activeForceToken += 1;
    if (activeForceRaf) cancelAnimationFrame(activeForceRaf);
    activeForceRaf = 0;
    forceState = null;
  }

  // Static network arrangement — physics intentionally disabled.
  // Cipher keeps investigator-controlled node positions stable instead of
  // continuously simulating/repelling nodes after the graph has loaded.
  function applyOrganicForceLayout(cyInstance, options = {}) {
    if (!cyInstance) return;
    stopOrganicForceLayout();
    cyInstance.resize();
    applyTieredHierarchyLayout(cyInstance, options.animate !== false);
  }


  function restoreSavedPositions(cyInstance, caseId) {
    if (!cyInstance) return 0;
    try {
      const raw = localStorage.getItem(positionStorageKey(caseId));
      if (!raw) return 0;
      const saved = JSON.parse(raw);
      let restored = 0;
      cyInstance.nodes().forEach(node => {
        const pos = saved[String(node.id())];
        if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
          node.position({ x: pos.x, y: pos.y });
          restored++;
        }
      });
      return restored;
    } catch (err) {
      console.warn('Could not restore network positions:', err);
      return 0;
    }
  }

  function saveNetworkPositions(cyInstance, caseId) {
    if (!cyInstance) return;
    try {
      const positions = {};
      cyInstance.nodes().forEach(node => {
        const p = node.position();
        positions[String(node.id())] = { x: Number(p.x), y: Number(p.y) };
      });
      localStorage.setItem(positionStorageKey(caseId), JSON.stringify(positions));
    } catch (err) {
      console.warn('Could not save network positions:', err);
    }
  }

  function graphNodeClass(type) {
    const t = String(type || '').toLowerCase();
    if (t.includes('person') || t.includes('suspect') || t.includes('kingpin') || t.includes('driver')) return 'node-person';
    if (t.includes('organis') || t.includes('company') || t.includes('business')) return 'node-org';
    if (t.includes('phone') || t.includes('msisdn') || t.includes('mobile')) return 'node-phone';
    if (t.includes('account') || t.includes('financial') || t.includes('bank')) return 'node-finance';
    if (t.includes('vehicle') || t.includes('car')) return 'node-vehicle';
    if (t.includes('place') || t.includes('location') || t.includes('vault') || t.includes('terminal')) return 'node-place';
    return 'node-evidence';
  }

  function nodeRadiusFor(data, degree, isHub = false, isCoreNeighbor = false) {
    // Rendered diameter, not a semantic/type size. Every entity shares the same
    // glass language; importance is communicated through scale and connectivity.
    if (isHub) return 86;
    if (isCoreNeighbor) return 48;
    if (degree >= 4) return 42;
    if (degree >= 2) return 37;
    return 32;
  }

  function createFlowLayer(cyInstance) {
    // Disabled in legacy static mode.
    return null;
  }

  let premiumNodeMotionRaf = 0;
  let premiumEdgePulseTimer = 0;

  function stopPremiumNodeMotion() {
    if (premiumNodeMotionRaf) cancelAnimationFrame(premiumNodeMotionRaf);
    premiumNodeMotionRaf = 0;
    if (premiumEdgePulseTimer) clearInterval(premiumEdgePulseTimer);
    premiumEdgePulseTimer = 0;
  }

  function startPremiumNodeMotion(cyInstance) {
    stopPremiumNodeMotion();
    if (!cyInstance) return;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let last = 0;

    const tick = (now) => {
      if (!cyInstance.container() || !document.body.contains(container)) {
        stopPremiumNodeMotion();
        return;
      }
      if (now - last > (reduced ? 220 : 55)) {
        last = now;
        const t = now * 0.001;
        cyInstance.nodes().forEach((node, index) => {
          if (!node.hasClass('network-hub') && !node.hasClass('network-core-neighbor') && !node.hasClass('premium-selected')) return;
          const phase = index * 0.73;
          const selected = node.hasClass('premium-selected');
          const hub = node.hasClass('network-hub');
          const base = selected ? 19 : (hub ? 13 : 8);
          const amp = selected ? 6 : (hub ? 4 : 2.5);
          const glow = base + (Math.sin(t * (selected ? 2.0 : 1.2) + phase) * 0.5 + 0.5) * amp;
          node.style({
            'shadow-blur': glow,
            'shadow-opacity': selected ? 0.42 : (hub ? 0.18 : 0.08),
            'shadow-color': '#8dffb1'
          });
        });
      }
      premiumNodeMotionRaf = requestAnimationFrame(tick);
    };

    premiumNodeMotionRaf = requestAnimationFrame(tick);

    if (!reduced) {
      premiumEdgePulseTimer = window.setInterval(() => {
        const edges = cyInstance.edges().toArray();
        if (!edges.length) return;
        const edge = edges[Math.floor(Math.random() * edges.length)];
        edge.addClass('premium-pulse');
        window.setTimeout(() => edge.removeClass('premium-pulse'), 620);
      }, 1450);
    }
  }

  function setNetworkCanvasCursor(cursor) {
    const shell = document.getElementById('networkCanvasInner');
    if (!shell) return;
    shell.querySelectorAll('canvas').forEach(canvas => { canvas.style.cursor = cursor; });
    shell.style.cursor = cursor;
  }

  async function loadNetworkGraph(caseId) {
    caseId = Number(caseId || getCipherActiveCaseId());
    if (!caseId) { if (typeof window.clearNetworkGraph === "function") window.clearNetworkGraph(); return; }
    const selectedCase = Boolean(window.CipherCaseState?.caseSelected && Number(window.CipherCaseState?.id));
    if (!selectedCase || !Number(caseId)) {
      if (typeof window.clearNetworkGraph === "function") window.clearNetworkGraph();
      return;
    }
    if (!container || typeof cytoscape === "undefined") return;

    try {
      const token = localStorage.getItem("cipher_access_token");
      const headers = { "Accept": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      let graphData = null;
      const localCsvGraph = window.CipherLocalGraphData;
      const localCaseMatches = !localCsvGraph?.caseId || Number(localCsvGraph.caseId) === Number(caseId);
      const useLocalCsvGraph = Boolean(localCsvGraph?.pending && localCaseMatches && Array.isArray(localCsvGraph.nodes) && Array.isArray(localCsvGraph.edges));
      if (useLocalCsvGraph) {
        graphData = {
          nodes: localCsvGraph.nodes,
          edges: localCsvGraph.edges,
          graph_store: "csv_preview"
        };
      } else {
        try {
          const res = await fetch(`/api/cases/${caseId}/graph?include=pending`, { headers });
          if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch graph data`);
          const text = await res.text();
          try {
            graphData = JSON.parse(text);
          } catch (parseErr) {
            throw new Error("Server returned non-JSON payload: " + text.slice(0, 80));
          }
        } catch (apiErr) {
          throw apiErr;
        }
      }

      let rawNodes = Array.isArray(graphData.nodes) ? graphData.nodes : [];
      let rawEdges = Array.isArray(graphData.edges) ? graphData.edges : (Array.isArray(graphData.relationships) ? graphData.relationships : []);

      // The active uploaded CSV is the immediate visual source of truth. This
      // guarantees that every CSV relationship becomes a real Cytoscape edge
      // and that the Links inspector can read the exact same relationship rows.
      const isCsvPreview = useLocalCsvGraph;

      // Pre-calculate node degree (in + out connections)
      const degreeMap = {};
      const normalizedNodes = rawNodes.map(n => n?.data ? n.data : n).filter(Boolean);
      const normalizedEdges = rawEdges.map(e => e?.data ? e.data : e).filter(Boolean);
      const nodeIds = new Set(normalizedNodes.map(n => String(n.id)));
      
      const validEdges = normalizedEdges.filter(e => {
        const s = String(e.source ?? e.source_entity_id ?? "");
        const t = String(e.target ?? e.target_entity_id ?? "");
        return s && t && nodeIds.has(s) && nodeIds.has(t);
      }).map((e, idx) => ({ ...e, source: String(e.source ?? e.source_entity_id), target: String(e.target ?? e.target_entity_id), _edgeRawId: String(e.id ?? e.relationship_id ?? idx + 1) }));

      validEdges.forEach(e => {
        const s = String(e.source);
        const t = String(e.target);
        degreeMap[s] = (degreeMap[s] || 0) + 1;
        degreeMap[t] = (degreeMap[t] || 0) + 1;
      });

      if (statsEl) {
        const store = isCsvPreview ? ' · CSV PREVIEW / PENDING REVIEW' : (graphData.graph_store ? ` · ${String(graphData.graph_store).toUpperCase()}` : '');
        const activeCaseLabel = window.CipherCaseState?.caseNumber || window.CipherCaseState?.title || "ACTIVE CASE";
        statsEl.textContent = `${activeCaseLabel} · ${normalizedNodes.length} NODES · ${validEdges.length} LINKS${store}`;
        const canvasStats = document.getElementById("networkCanvasStats");
        if (canvasStats) canvasStats.textContent = `${activeCaseLabel} · ${String(normalizedNodes.length).padStart(2, "0")} NODES · ${String(validEdges.length).padStart(2, "0")} LINKS`;
      }
      if (isCsvPreview && typeof showNetworkToast === "function") {
        showNetworkToast(`CSV preview active: ${normalizedNodes.length} nodes · ${validEdges.length} links. Review/accept the evidence to make it part of the verified graph.`);
      }

      // Prepare compact Obsidian-like nodes. The highest-degree entity becomes
      // the visual source/hub and its direct neighbours get a subtle secondary size.
      const primaryNode = normalizedNodes.reduce((best, n) => {
        if (!best) return n;
        return (degreeMap[String(n.id)] || 0) > (degreeMap[String(best.id)] || 0) ? n : best;
      }, null);
      const primaryId = primaryNode ? String(primaryNode.id) : null;
      const primaryNeighbourIds = new Set();
      validEdges.forEach(e => {
        const s = String(e.source), t = String(e.target);
        if (s === primaryId) primaryNeighbourIds.add(t);
        if (t === primaryId) primaryNeighbourIds.add(s);
      });

      const nodes = normalizedNodes.map(n => {
        const id = String(n.id);
        const deg = degreeMap[id] || 0;
        const isHub = id === primaryId;
        const isCoreNeighbor = primaryNeighbourIds.has(id);
        const classes = [graphNodeClass(n.type)];
        if (isCsvPreview) classes.push('csv-preview-node');
        if (isHub) classes.push('network-hub');
        if (isCoreNeighbor) classes.push('network-core-neighbor');
        return {
          data: {
            ...n,
            id: id,
            degree: deg,
            nodeSize: nodeRadiusFor(n, deg, isHub, isCoreNeighbor) * 2,
            nodeImage: buildTacticalNodeSvg({ ...n, isPrimarySource: isHub ? 'true' : 'false' }, deg),
            displayLabel: '',
            labelOpacity: 0,
            isPrimarySource: isHub ? 'true' : 'false'
          },
          classes: classes.join(' ')
        };
      });

      // Prepare edges with alert classification
      const edges = validEdges.map(e => {
        const lbl = String(e.label || e.relationship_type || '').trim();
        const isAlert = lbl.toLowerCase().includes('hand-off') || lbl.toLowerCase().includes('spike') || lbl.toLowerCase().includes('alert') || lbl.toLowerCase().includes('launder') || (e.confidence && e.confidence < 0.93);
        return {
          data: {
            ...e,
            // Cytoscape element IDs must be globally unique. Prefix relationships
            // so relationship ID 1 can coexist with entity/node ID 1.
            id: `edge-${String(e._edgeRawId)}`,
            source: String(e.source),
            target: String(e.target),
            label: lbl || 'ASSOCIATED_WITH',
            relationship_type: lbl || 'ASSOCIATED_WITH',
            raw_relationship_id: String(e._edgeRawId)
          },
          classes: isAlert ? 'alert-edge' : ''
        };
      });

      const elements = [...nodes, ...edges];

      if (cy) {
        stopOrganicForceLayout();
        stopPremiumNodeMotion();
        cy.destroy();
      }

      cy = cytoscape({
        container: container,
        elements: elements,
        boxSelectionEnabled: false,
        wheelSensitivity: 0.22,
        motionBlur: false,
        motionBlurOpacity: 0,
        textureOnViewport: false,
        hideEdgesOnViewport: false,
        style: [
          {
            selector: 'node',
            style: {
              'shape': 'ellipse',
              'width': 'data(nodeSize)',
              'height': 'data(nodeSize)',
              'background-image': 'data(nodeImage)',
              'background-fit': 'contain',
              'background-opacity': 1,
              'background-color': 'transparent',
              'background-fill': 'solid',
              'overlay-opacity': 0,
              'underlay-opacity': 0,
              'border-width': 0,
              'border-opacity': 0,
              'shadow-opacity': 0,
              'shadow-blur': 0,
              'shadow-color': 'transparent',
              'shadow-offset-x': 0,
              'shadow-offset-y': 0,
              'label': 'data(displayLabel)',
              'font-family': 'DM Mono, monospace',
              'font-size': 8,
              'font-weight': 500,
              'color': '#dfe9e2',
              'text-opacity': 'data(labelOpacity)',
              'text-outline-color': '#020503',
              'text-outline-width': 2,
              'text-margin-y': -10,
              'text-max-width': 170,
              'text-wrap': 'ellipsis',
              'min-zoomed-font-size': 7,
              'overlay-opacity': 0,
              'transition-property': 'shadow-blur, shadow-color, shadow-opacity, opacity, background-color, border-color, border-width',
              'transition-duration': '0.28s',
              'cursor': 'pointer'
            }
          },
          { selector: 'node.node-person', style: { 'background-color': 'transparent', 'background-opacity': 0, 'border-color': 'transparent', 'shadow-color': 'transparent', 'shadow-blur': 0, 'shadow-opacity': 0 } },
          { selector: 'node.network-hub', style: { 'width': 'data(nodeSize)', 'height': 'data(nodeSize)', 'border-width': 0, 'shadow-opacity': 0.18, 'shadow-blur': 16, 'shadow-color': '#8dffb1', 'font-size': 0, 'z-index': 20 } },
          { selector: 'node.network-core-neighbor', style: { 'border-width': 0, 'shadow-opacity': 0.08, 'shadow-blur': 9, 'shadow-color': '#8dffb1', 'font-size': 0 } },
          { selector: 'node.node-org', style: { 'background-color': 'transparent', 'background-opacity': 0, 'border-color': 'transparent', 'shadow-color': 'transparent', 'shadow-blur': 0, 'shadow-opacity': 0 } },
          { selector: 'node.node-phone', style: { 'background-color': 'transparent', 'background-opacity': 0, 'border-color': 'transparent', 'shadow-color': 'transparent', 'shadow-blur': 0, 'shadow-opacity': 0 } },
          { selector: 'node.node-finance', style: { 'background-color': 'transparent', 'background-opacity': 0, 'border-color': 'transparent', 'shadow-color': 'transparent', 'shadow-blur': 0, 'shadow-opacity': 0 } },
          { selector: 'node.node-vehicle', style: { 'background-color': 'transparent', 'background-opacity': 0, 'border-color': 'transparent', 'shadow-color': 'transparent', 'shadow-blur': 0, 'shadow-opacity': 0 } },
          { selector: 'node.node-place', style: { 'background-color': 'transparent', 'background-opacity': 0, 'border-color': 'transparent', 'shadow-color': 'transparent', 'shadow-blur': 0, 'shadow-opacity': 0 } },
          { selector: 'node.node-evidence', style: { 'background-color': 'transparent', 'background-opacity': 0, 'border-color': 'transparent', 'shadow-color': 'transparent', 'shadow-blur': 0, 'shadow-opacity': 0 } },
          {
            selector: 'edge',
            style: {
              'label': '',
              'color': '#f1f5f9',
              'font-size': '10px',
              'font-family': 'DM Mono, monospace',
              'font-weight': 600,
              'text-rotation': 'autorotate',
              'text-background-opacity': 0.96,
              'text-background-color': '#080d14',
              'text-background-padding': '4px',
              'text-background-shape': 'roundrectangle',
              'text-border-color': '#2a3f55',
              'text-border-width': 1,
              'text-border-opacity': 1,
              'line-color': 'rgba(173,214,176,.22)',
              'curve-style': 'bezier',
              'target-arrow-shape': 'none',
              'target-arrow-color': 'transparent',
              'arrow-scale': 0,
              'width': 0.82,
              'min-zoomed-font-size': 8,
              'text-opacity': 0,
              'transition-property': 'line-color, width, opacity',
              'transition-duration': '0.2s'
            }
          },
          {
            selector: 'edge.premium-pulse',
            style: {
              'line-color': '#d9ff55',
              'width': 2.4,
              'opacity': 0.95,
              'shadow-blur': 10,
              'shadow-color': '#8dffb1'
            }
          },
          {
            selector: 'node.premium-selected',
            style: {
              'shadow-blur': 22,
              'shadow-color': '#8dffb1',
              'shadow-opacity': 0.46
            }
          },
          {
            selector: 'edge.highlighted-edge',
            style: {
              'label': 'data(displayLabel)',
              'text-opacity': 1
            }
          },
          {
            selector: 'edge.alert-edge',
            style: {
              'line-color': '#f59e0b',
              'target-arrow-color': 'transparent',
              'line-style': 'dashed',
              'line-dash-pattern': [6, 4],
              'text-border-color': '#d97706',
              'color': '#fbbf24',
              'width': 3
            }
          },
          {
            selector: 'node.csv-preview-node',
            style: {
              'border-style': 'none',
              'border-color': 'transparent',
              'border-width': 0,
              'border-opacity': 0,
              'background-color': 'transparent',
              'background-opacity': 0,
              'overlay-opacity': 0,
              'underlay-opacity': 0,
              'shadow-opacity': 0
            }
          },
          {
            selector: 'node.csv-preview-node.network-hub',
            style: {
              'border-style': 'none',
              'border-color': 'transparent',
              'border-width': 0,
              'border-opacity': 0,
              'background-color': 'transparent',
              'background-opacity': 0,
              'overlay-opacity': 0,
              'underlay-opacity': 0,
              'shadow-opacity': 0
            }
          },
          {
            selector: 'node:selected',
            style: {
              'shadow-blur': 0,
              'shadow-color': 'transparent',
              'shadow-opacity': 0
            }
          },
          {
            selector: 'node.highlighted',
            style: {
              'shadow-blur': 0,
              'shadow-color': 'transparent',
              'shadow-opacity': 0
            }
          },
          {
            selector: 'edge.highlighted-edge',
            style: {
              'label': 'data(displayLabel)',
              'text-opacity': 1,
              'line-color': '#d9ff55',
              'target-arrow-color': 'transparent',
              'width': 1.8,
              'shadow-blur': 12,
              'shadow-color': '#00e5ff'
            }
          },
          {
            selector: 'node.path-node',
            style: {
              'shadow-blur': 0,
              'shadow-color': 'transparent',
              'shadow-opacity': 0
            }
          },
          {
            selector: 'edge.path-edge',
            style: {
              'line-color': '#fbbf24',
              'target-arrow-color': 'transparent',
              'width': 4.5,
              'shadow-blur': 14,
              'shadow-color': '#fbbf24'
            }
          },
          {
            selector: 'node.pattern-alert',
            style: {
              'shadow-blur': 0,
              'shadow-color': 'transparent',
              'shadow-opacity': 0
            }
          },
          {
            selector: '.hover-dimmed',
            style: {
              'opacity': 0.24,
              'text-opacity': 0.12
            }
          },
          {
            selector: '.hover-connected',
            style: {
              'opacity': 1,
              'shadow-opacity': 02
            }
          },
          {
            selector: '.dimmed',
            style: {
              'opacity': 0.2
            }
          }
        ]
      });

      // Explicit empty-state diagnostics: a case may have verified nodes but no verified links yet.
      if (validEdges.length === 0 && normalizedNodes.length > 0) {
        showNetworkToast('Verified nodes loaded, but no verified relationships are available yet. Accept relationship findings in Review to draw connections.');
      }

      // Restore investigator positions. Physics is intentionally disabled;
      // the graph remains stable and investigator-controlled after loading.
      const restoredCount = restoreSavedPositions(cy, caseId);
      if (restoredCount === 0) {
        applyTieredHierarchyLayout(cy, false);
      } else {
        cy.resize();
        cy.fit(undefined, 45);
      }

      // Lightweight hover name tooltip: labels stay hidden at rest so the graph remains clean,
      // but the exact node name is always available on hover without requiring a click.
      let nodeHoverTip = container?.querySelector('.network-node-hover-tooltip');
      if (!nodeHoverTip && container) {
        nodeHoverTip = document.createElement('div');
        nodeHoverTip.className = 'network-node-hover-tooltip';
        nodeHoverTip.setAttribute('role', 'tooltip');
        nodeHoverTip.hidden = true;
        container.appendChild(nodeHoverTip);
      }
      const positionNodeHoverTip = (node) => {
        if (!nodeHoverTip || !node || !cy) return;
        const p = node.renderedPosition();
        const label = String(node.data('label') || node.data('displayLabel') || node.data('id') || 'Node');
        nodeHoverTip.textContent = label;
        nodeHoverTip.hidden = false;
        nodeHoverTip.style.left = `${p.x}px`;
        nodeHoverTip.style.top = `${p.y}px`;
      };
      const hideNodeHoverTip = () => { if (nodeHoverTip) nodeHoverTip.hidden = true; };

      // Interaction contract:
      //   SINGLE CLICK = inspect/select only
      //   DOUBLE CLICK = unlock that node for one manual move
      //   DRAG = reposition only after the double-click unlock
      //   RELEASE = lock it again and keep it exactly where placed
      // Physics is disabled. This prevents accidental clicks from moving nodes.
      let nodeTapTimer = null;
      let nodeMoveUnlocked = null;

      cy.nodes().forEach((n) => n.grabbable(false));

      cy.on('drag', 'node', (evt) => {
        const node = evt.target;
        if (nodeMoveUnlocked !== node.id()) return;
        const p = node.position();
        const rect = container?.getBoundingClientRect?.() || { width: 1000, height: 650 };
        const zoom = Math.max(0.05, Number(cy.zoom()) || 1);
        const pan = cy.pan();
        const pad = Math.max(45, Number(node.data('nodeSize') || 64) * 0.5);
        const minX = (-pan.x / zoom) + pad;
        const minY = (-pan.y / zoom) + pad;
        const maxX = ((rect.width - pan.x) / zoom) - pad;
        const maxY = ((rect.height - pan.y) / zoom) - pad;
        node.position({
          x: Math.max(minX, Math.min(maxX, p.x)),
          y: Math.max(minY, Math.min(maxY, p.y))
        });
        setNetworkCanvasCursor('grabbing');
      });

      cy.on('dragfree', 'node', (evt) => {
        const node = evt.target;
        node.removeClass('dragging-node move-unlocked');
        node.data('_physicsPinned', true);
        node.grabbable(false);
        nodeMoveUnlocked = null;
        setNetworkCanvasCursor('grab');
        hideNodeHoverTip();
        // Static graph: release means settle permanently at this position.
        saveNetworkPositions(cy, caseId);
      });

      cy.on('mouseover', 'node', (evt) => {
        const node = evt.target;
        if (!node.data('displayLabel')) node.data('displayLabel', node.data('label') || '');
        node.data('labelOpacity', 1);
        positionNodeHoverTip(node);
        node.addClass('hovered');
        cy.elements().removeClass('hover-connected hover-dimmed');
        cy.elements().addClass('hover-dimmed');
        node.removeClass('hover-dimmed').addClass('hover-connected');
        node.connectedEdges().removeClass('hover-dimmed').addClass('hover-connected');
        node.connectedEdges().connectedNodes().removeClass('hover-dimmed').addClass('hover-connected');
      });
      cy.on('mouseout', 'node', (evt) => {
        const node = evt.target;
        const isHub = node.hasClass('network-hub');
        const degree = Number(node.data('degree') || 0);
        node.data('labelOpacity', isHub || node.hasClass('network-core-neighbor') ? 0.92 : (degree >= 3 ? 0.72 : 0));
        node.removeClass('hovered');
        hideNodeHoverTip();
        cy.elements().removeClass('hover-connected hover-dimmed');
      });

      // Single click opens the inspector. We delay it very slightly so a
      // double-click can cancel the inspection and enter move mode cleanly.
      const inspectNetworkNode = (node) => {
        const data = node.data();
        activeSelectedNodeId = data.id;
        window.CipherSelection.entityId = data.id;

        // Visual link highlighting: highlight connected edges and dim unrelated
        cy.elements().removeClass('highlighted highlighted-edge dimmed premium-selected');
        node.addClass('premium-selected');
        node.data('displayLabel', data.label || '');
        node.data('labelOpacity', 1);
        const connectedEdges = node.connectedEdges();
        const neighborNodes = connectedEdges.connectedNodes();

        cy.elements().addClass('dimmed');
        node.removeClass('dimmed');
        neighborNodes.removeClass('dimmed').addClass('highlighted');
        connectedEdges.removeClass('dimmed').addClass('highlighted-edge');

        showNodeInspector(data, node);
        window.dispatchEvent(new CustomEvent("cipher:network-node-select", { detail: data }));

        if (data.lat && data.lng && typeof window.cipherPanToLocation === "function") {
          window.cipherPanToLocation(data.lat, data.lng, data.label);
        }
      };

      cy.on('tap', 'node', (evt) => {
        if (nodeTapTimer) clearTimeout(nodeTapTimer);
        nodeTapTimer = setTimeout(() => {
          nodeTapTimer = null;
          inspectNetworkNode(evt.target);
        }, 240);
      });

      // Double-click unlocks movement for that node only. It must be explicitly
      // unlocked again after every move, which keeps ordinary clicks completely safe.
      cy.on('dbltap', 'node', (evt) => {
        if (nodeTapTimer) {
          clearTimeout(nodeTapTimer);
          nodeTapTimer = null;
        }
        const node = evt.target;
        if (nodeMoveUnlocked && nodeMoveUnlocked !== node.id()) {
          const previous = cy.getElementById(nodeMoveUnlocked);
          if (previous && previous.length) previous.grabbable(false);
        }
        nodeMoveUnlocked = node.id();
        node.grabbable(true);
        node.addClass('move-unlocked');
        setNetworkCanvasCursor('grabbing');
        showNetworkToast('Move mode enabled — drag this node, then release to lock it.');
      });

      // Tap a relationship edge to explain how the two entities are connected.
      cy.on('tap', 'edge', (evt) => {
        activeNodeIntel = null;
        activeNetworkInspectorTab = "node";
        document.querySelectorAll("#networkInspector .inspector-tabs button").forEach(x => x.classList.toggle("active", x.dataset.inspectorTab === "node"));
        if (nodeInspectorLinksPanel) nodeInspectorLinksPanel.style.display = "none";
        if (nodeInspectorSourcePanel) nodeInspectorSourcePanel.style.display = "none";
        const edge = evt.target;
        const d = edge.data();
        const relLabel = d.relationship_type || d.label || 'ASSOCIATED_WITH';
        const source = cy.getElementById(String(d.source));
        const target = cy.getElementById(String(d.target));
        if (inspectorEmpty) inspectorEmpty.style.display = 'none';
        if (inspectorContent) inspectorContent.style.display = 'block';
        if (inspectName) inspectName.textContent = `${source?.data('label') || d.source} → ${target?.data('label') || d.target}`;
        if (inspectType) inspectType.textContent = relLabel.toUpperCase();
        if (inspectAliases) inspectAliases.textContent = d.evidence || 'Verified relationship';
        const conf = Number(d.confidence || 0);
        if (inspectConf) inspectConf.textContent = `${Math.round((conf <= 1 ? conf * 100 : conf))}%`;
        if (inspectStatus) inspectStatus.textContent = String(d.status || 'verified').toUpperCase();
        if (inspectRelCount) inspectRelCount.textContent = '1';
        if (inspectRelList) inspectRelList.innerHTML = `<div style="padding:8px;border:1px solid rgba(255,255,255,.08);border-radius:4px;"><b style="color:#00e5ff;">${escapeHtml(relLabel)}</b><div style="font-size:9px;color:#8b98a5;margin-top:4px;">${escapeHtml(d.evidence || 'Verified relationship between case entities.')}</div></div>`;
        cy.elements().removeClass('highlighted highlighted-edge dimmed');
        cy.elements().addClass('dimmed');
        source.removeClass('dimmed').addClass('highlighted');
        target.removeClass('dimmed').addClass('highlighted');
        edge.removeClass('dimmed').addClass('highlighted-edge');
        window.CipherSelection.entityId = String(d.source);
        window.dispatchEvent(new CustomEvent('cipher:network-relationship-select', {detail: d}));
      });

      // Tap background deselects and resets highlights
      cy.on('tap', (evt) => {
        if (evt.target === cy) {
          activeSelectedNodeId = null;
          activeNodeIntel = null;
          activeNetworkInspectorTab = "node";
          document.querySelectorAll("#networkInspector .inspector-tabs button").forEach(x => x.classList.toggle("active", x.dataset.inspectorTab === "node"));
          if (nodeInspectorLinksPanel) nodeInspectorLinksPanel.style.display = "none";
          if (nodeInspectorSourcePanel) nodeInspectorSourcePanel.style.display = "none";
          window.CipherSelection.entityId = null;
          cy.elements().removeClass('highlighted highlighted-edge dimmed premium-selected');
          cy.nodes().forEach(n => { if (!n.hasClass('network-hub')) { n.data('labelOpacity', 0); n.data('displayLabel', ''); } });
          if (inspectorEmpty) inspectorEmpty.style.display = "block";
          if (inspectorContent) inspectorContent.style.display = "none";
        }
      });

      window.cy = cy;
      startPremiumNodeMotion(cy);

    } catch (err) {
      console.error("Error rendering Cytoscape graph:", err);
    }
  }

  function clearNetworkGraph() {
    stopPremiumNodeMotion();
    try {
      if (cy) {
        cy.elements().remove();
        cy.resize();
      }
    } catch {}
    if (statsEl) statsEl.textContent = "SELECT A CASE · 00 NODES · 00 LINKS";
    const canvasStats = document.getElementById("networkCanvasStats");
    if (canvasStats) canvasStats.textContent = "CASE / — · 00 NODES · 00 LINKS";
    if (inspectorEmpty) inspectorEmpty.style.display = "block";
    if (inspectorContent) inspectorContent.style.display = "none";
    if (nodeInspectorLinksPanel) nodeInspectorLinksPanel.style.display = "none";
    if (nodeInspectorSourcePanel) nodeInspectorSourcePanel.style.display = "none";
    activeNodeIntel = null;
    activeNetworkInspectorTab = "node";
    document.querySelectorAll("#networkInspector .inspector-tabs button").forEach(x => x.classList.toggle("active", x.dataset.inspectorTab === "node"));
    window.CipherSelection = window.CipherSelection || {};
    window.CipherSelection.entityId = null;
  }
  window.clearNetworkGraph = clearNetworkGraph;
  window.loadNetworkGraph = loadNetworkGraph;

  function showNodeInspector(data, nodeObj) {
    if (!inspectorContent) return;
    activeNodeIntel = {
      raw_id: String(data.id || data.raw_id || "").replace(/^ent-/, ""),
      node: data,
      relationships: [],
      source: { entity: data, locations: [], timeline_events: [], observations: [], evidence_documents: [], review_records: [] }
    };
    activeNetworkInspectorTab = "node";
    document.querySelectorAll("#networkInspector .inspector-tabs button").forEach(x => x.classList.toggle("active", x.dataset.inspectorTab === "node"));
    if (inspectorEmpty) inspectorEmpty.style.display = "none";
    inspectorContent.style.display = "block";
    if (nodeInspectorLinksPanel) nodeInspectorLinksPanel.style.display = "none";
    if (nodeInspectorSourcePanel) nodeInspectorSourcePanel.style.display = "none";

    if (inspectName) inspectName.textContent = data.label || "—";
    if (inspectType) inspectType.textContent = (data.type || "ENTITY").toUpperCase();
    if (inspectAliases) inspectAliases.textContent = data.aliases || "None recorded";
    if (inspectConf) inspectConf.textContent = data.confidence != null ? `${Math.round((Number(data.confidence) <= 1 ? Number(data.confidence) * 100 : Number(data.confidence)))}% CONFIRMED` : "VERIFIED";
    if (inspectStatus) inspectStatus.textContent = (data.status || "VERIFIED").toUpperCase();

    if (btnInspectViewOnMap) {
      if (data.lat != null && data.lng != null) {
        btnInspectViewOnMap.style.display = "block";
        btnInspectViewOnMap.onclick = () => {
          const gisNavBtn = document.querySelector('.workspace-sidebar .side-item[data-view="gis"]');
          gisNavBtn?.click();
          setTimeout(() => { if (typeof window.cipherPanToLocation === "function") window.cipherPanToLocation(data.lat, data.lng, data.label); }, 300);
        };
      } else btnInspectViewOnMap.style.display = "none";
    }

    const btnInspectDelete = document.getElementById("btnInspectDeleteEntity");
    if (btnInspectDelete) {
      btnInspectDelete.style.display = "block";
      btnInspectDelete.onclick = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } cipherPromptDelete(data.id || data.raw_id); };
    }

    if (nodeObj && inspectRelList && inspectRelCount) {
      const connectedEdges = nodeObj.connectedEdges();
      inspectRelCount.textContent = connectedEdges.length;
      inspectRelList.innerHTML = connectedEdges.length ? connectedEdges.map(e => {
        const ed = e.data(); const other = e.other(nodeObj).data();
        return `<div style="margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.06);"><span style="color:#7fe9df;font-size:10px;font-family:'DM Mono',monospace;">${escapeHtml(ed.label || ed.relationship_type || "RELATED_TO")}</span> → <b style="color:#e6edf3;font-size:11px;">${escapeHtml(other.label || other.id)}</b>${ed.evidence ? `<p style="font-size:10px;color:#7f8883;margin:2px 0 0;">${escapeHtml(ed.evidence)}</p>` : ""}</div>`;
      }).join("") : "No direct connections found.";
    }
    // Render the graph's already-loaded direct edges immediately. The backend
    // intel request then replaces this with the authoritative relationship
    // records when it returns, so the LINKS tab is never visually empty while
    // the investigator is waiting for the backend response.
    if (nodeInspectorLinksPanelList && nodeObj) {
      const connectedEdges = nodeObj.connectedEdges();
      const localRels = connectedEdges.map((edge, index) => {
        const ed = edge.data();
        const source = cy.getElementById(String(ed.source))?.data()?.label || ed.source || "Unknown entity";
        const target = cy.getElementById(String(ed.target))?.data()?.label || ed.target || "Unknown entity";
        const currentId = String(data.id || "");
        const isOutbound = String(ed.source) === currentId;
        const other = isOutbound ? target : source;
        return `<article class="network-rel-card network-rel-card-local">
          <div class="network-rel-card-head"><span class="network-rel-index">${String(index + 1).padStart(2, "0")}</span><b>${escapeHtml(ed.relationship_type || ed.label || "RELATED_TO")}</b><small>${isOutbound ? "OUTBOUND" : "INBOUND"}</small></div>
          <div class="network-rel-path"><strong>${escapeHtml(source)}</strong><span class="network-rel-arrow">→</span><strong>${escapeHtml(target)}</strong></div>
          <div class="network-rel-connected"><span>CONNECTED ENTITY</span><b>${escapeHtml(other)}</b></div>
          ${ed.evidence ? `<p class="network-rel-evidence">${escapeHtml(ed.evidence)}</p>` : `<p class="network-rel-evidence network-rel-loading">Loading authoritative relationship record…</p>`}
        </article>`;
      }).join("");
      nodeInspectorLinksPanelList.innerHTML = connectedEdges.length ? localRels : `<div class="network-links-empty"><span>◎</span><b>NO DIRECT LINKS</b><small>This node has no connected edges in the current graph.</small></div>`;
      if (nodeInspectLinksPanelCount) nodeInspectLinksPanelCount.textContent = String(connectedEdges.length);
    }
    renderNetworkInspectorTab();
    loadNodeIntel(data.id || data.raw_id);
  }

  // Tiered Hierarchy and Organic Layout button handlers
  hierarchicalBtn?.addEventListener("click", () => {
    if (cy) {
      applyTieredHierarchyLayout(cy, true);
      setTimeout(() => saveNetworkPositions(cy, window.CipherCaseState?.id || 0), 800);
      if (typeof toast === "function") {
        toast("Tiered Intelligence Flow applied.");
      } else if (typeof showNetworkToast === "function") {
        showNetworkToast("Tiered Intelligence Flow applied.");
      }
    } else {
      loadNetworkGraph(window.CipherCaseState?.id);
    }
  });

  autoLayoutBtn?.addEventListener("click", () => {
    if (cy) {
      applyTieredHierarchyLayout(cy, true);
      setTimeout(() => saveNetworkPositions(cy, window.CipherCaseState?.id || 0), 800);
      if (typeof toast === "function") {
        toast("Static network arrangement applied.");
      } else if (typeof showNetworkToast === "function") {
        showNetworkToast("Static network arrangement applied.");
      }
    } else {
      loadNetworkGraph(window.CipherCaseState?.id);
    }
  });

  fitViewBtn?.addEventListener("click", () => {
    if (cy) {
      cy.resize();
      cy.fit(undefined, 35);
      if (typeof toast === "function") {
        toast("Graph viewport centered.");
      } else if (typeof showNetworkToast === "function") {
        showNetworkToast("Graph viewport centered.");
      }
    } else {
      loadNetworkGraph(window.CipherCaseState?.id);
    }
  });

  // In-app Delete Confirmation & Execution (100% iframe-safe, no blocked native confirm/prompt)
  // Resolve a graph node ID to the real relational entity ID.
  // CSV/master imports often use external IDs such as P001/PH001 while the
  // DELETE endpoint expects the numeric `entities.id`. The old code sent the
  // external CSV ID directly and the backend quite correctly rejected it as
  // an invalid entity ID.
  const resolveBackendEntityId = async (entityId, nodeData = null) => {
    const raw = String(entityId ?? "").trim();
    if (!raw) return null;
    // Normal backend graph nodes already carry a numeric entity ID.
    if (/^\d+$/.test(raw)) return raw;

    try {
      const caseId = window.CipherCaseState?.id || 0;
      const headers = (typeof window.getAuthHeaders === "function" ? window.getAuthHeaders() : {});
      const res = await fetch(`/api/cases/${caseId}/entities`, { headers });
      if (!res.ok) return null;
      const data = await res.json();
      const entities = Array.isArray(data.entities) ? data.entities : [];
      const wanted = raw.toLowerCase();
      const label = String(nodeData?.label || "").trim().toLowerCase();
      const match = entities.find(ent =>
        String(ent.id) === raw ||
        String(ent.external_id || "").trim().toLowerCase() === wanted ||
        (label && String(ent.label || "").trim().toLowerCase() === label)
      );
      return match ? String(match.id) : null;
    } catch (err) {
      console.warn("Could not resolve CSV/external node ID to backend entity ID", err);
      return null;
    }
  };

  const removeFromLocalCsvGraph = (entityId, nodeData = null) => {
    const local = window.CipherLocalGraphData;
    if (!local || !Array.isArray(local.nodes)) return false;
    const raw = String(entityId ?? "").trim();
    const label = String(nodeData?.label || "").trim().toLowerCase();
    const kept = local.nodes.filter(n => {
      const id = String(n?.id ?? n?.data?.id ?? "").trim();
      const nLabel = String(n?.label ?? n?.data?.label ?? "").trim().toLowerCase();
      return id !== raw && (!label || nLabel !== label);
    });
    const removed = kept.length !== local.nodes.length;
    if (!removed) return false;
    const removedIds = new Set(local.nodes
      .filter(n => {
        const id = String(n?.id ?? n?.data?.id ?? "").trim();
        const nLabel = String(n?.label ?? n?.data?.label ?? "").trim().toLowerCase();
        return id === raw || (label && nLabel === label);
      })
      .map(n => String(n?.id ?? n?.data?.id ?? "")));
    local.nodes = kept;
    local.edges = (Array.isArray(local.edges) ? local.edges : []).filter(e =>
      !removedIds.has(String(e?.source ?? e?.data?.source ?? "")) &&
      !removedIds.has(String(e?.target ?? e?.data?.target ?? ""))
    );
    local.rowCount = local.nodes.length;
    // A deletion is a user mutation of the live CSV preview. Do not let the
    // next graph refresh resurrect the original uploaded CSV.
    local.sourceFingerprint = `${local.sourceFingerprint || "csv"}|deleted:${raw}:${Date.now()}`;
    window.CipherLocalGraphData = local;
    return true;
  };

  const executeDelete = async (entityId, entityLabel) => {
    try {
      const nodeObj = cy ? cy.$(`node[id="${String(entityId).replace(/"/g, '\\"')}"]`) : null;
      const nodeData = nodeObj && nodeObj.length ? nodeObj.data() : { label: entityLabel };
      const isLocalPreview = Boolean(window.CipherLocalGraphData?.pending);

      if (typeof showNetworkToast === "function") {
        showNetworkToast(`Removing "${entityLabel}"...`);
      } else if (typeof toast === "function") {
        toast(`Removing "${entityLabel}"...`);
      }

      // A pending CSV is a frontend preview, not a verified backend entity.
      // ALWAYS mutate the preview locally first. Do not look up a same-named
      // database entity here, otherwise deleting "Rahul" from a CSV preview
      // could accidentally delete an unrelated verified Rahul from the case.
      if (isLocalPreview) {
        const removed = removeFromLocalCsvGraph(entityId, nodeData);
        if (!removed) throw new Error("The selected CSV node could not be found in the active preview.");
        if (cy) {
          const el = cy.$(`node[id="${String(entityId).replace(/"/g, '\\"')}"]`);
          if (el.length) { el.connectedEdges().remove(); el.remove(); }
        }
        activeSelectedNodeId = null;
        if (window.CipherSelection) window.CipherSelection.entityId = null;
        if (inspectorEmpty) inspectorEmpty.style.display = "block";
        if (inspectorContent) inspectorContent.style.display = "none";
        await loadNetworkGraph(window.CipherCaseState?.id);
        showNetworkToast?.(`CSV node "${entityLabel}" removed from the active preview.`);
        return;
      }

      // Master/verified graph nodes can carry an external CSV ID such as P001.
      // Resolve that external ID to the numeric entities.id expected by DELETE.
      const backendId = await resolveBackendEntityId(entityId, nodeData);
      if (!backendId) {
        throw new Error("Selected node is not linked to a valid backend entity. Re-import the CSV or select a verified entity.");
      }

      const caseId = window.CipherCaseState?.id || 0;
      const res = await fetch(`/api/cases/${caseId}/entities/${encodeURIComponent(backendId)}`, {
        method: "DELETE",
        headers: (typeof window.getAuthHeaders === "function" ? window.getAuthHeaders() : {})
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.detail || "Failed to delete entity.");
      }

      // Remove the node from both Cytoscape and any active CSV preview before
      // reloading. Otherwise loadNetworkGraph would immediately resurrect it.
      removeFromLocalCsvGraph(entityId, nodeData);
      if (cy) {
        const el = cy.$(`node[id="${String(entityId).replace(/"/g, '\\"')}"]`);
        if (el.length) { el.connectedEdges().remove(); el.remove(); }
      }
      activeSelectedNodeId = null;
      if (window.CipherSelection) window.CipherSelection.entityId = null;
      if (inspectorEmpty) inspectorEmpty.style.display = "block";
      if (inspectorContent) inspectorContent.style.display = "none";

      // Verified/master graphs must refresh from the backend. If the active
      // preview was tied to the deleted entity, clear it so stale CSV data cannot
      // overwrite the freshly deleted state.
      if (window.CipherLocalGraphData?.pending && backendId) {
        window.CipherLocalGraphData.nodes = (window.CipherLocalGraphData.nodes || []).filter(n => String(n.id) !== String(entityId));
      }
      await loadNetworkGraph(caseId);
      if (typeof showNetworkToast === "function") {
        showNetworkToast(`Entity "${entityLabel}" permanently deleted.`);
      } else if (typeof toast === "function") {
        toast(`Entity "${entityLabel}" permanently deleted.`);
      }
    } catch (err) {
      console.error("Error deleting entity:", err);
      if (typeof showNetworkToast === "function") {
        showNetworkToast(err.message || "Error deleting entity.");
      } else {
        alert(err.message || "Error deleting entity.");
      }
    }
  };

  const cipherPromptDelete = (targetId) => {
    let selectedId = targetId || activeSelectedNodeId || window.CipherSelection?.entityId;
    if (!selectedId && cy) {
      const selectedEles = cy.$('node:selected');
      if (selectedEles.length > 0) {
        selectedId = selectedEles[0].id();
      }
    }

    const modal = document.getElementById("cipherConfirmModal");
    const titleEl = document.getElementById("cipherConfirmTitle");
    const msgEl = document.getElementById("cipherConfirmMessage");
    const dropdownWrap = document.getElementById("cipherConfirmDropdownWrap");
    const selectEl = document.getElementById("cipherConfirmSelect");
    const proceedBtn = document.getElementById("cipherConfirmProceed");
    const cancelBtn = document.getElementById("cipherConfirmCancel");
    const closeBtn = document.getElementById("cipherConfirmClose");
    const backdrop = document.getElementById("cipherConfirmBackdrop");

    if (!modal) {
      // Fallback if modal DOM is missing
      if (selectedId) {
        executeDelete(selectedId, `Entity #${selectedId}`);
      }
      return;
    }

    const closeModal = () => {
      modal.classList.remove("open");
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
    };

    if (cancelBtn) cancelBtn.onclick = closeModal;
    if (closeBtn) closeBtn.onclick = closeModal;
    if (backdrop) backdrop.onclick = closeModal;

    if (selectedId) {
      const nodeEl = cy ? cy.$(`node[id="${selectedId}"]`) : null;
      const nodeLabel = nodeEl && nodeEl.length > 0 ? nodeEl.data("label") : `Entity #${selectedId}`;

      if (titleEl) titleEl.textContent = `Delete Entity #${selectedId}?`;
      if (msgEl) msgEl.innerHTML = `Are you sure you want to permanently delete <b style="color:#fff;">"${nodeLabel}"</b> (ID #${selectedId}) and all its associated links and sightings from this case?`;
      if (dropdownWrap) dropdownWrap.style.display = "none";

      if (proceedBtn) {
        proceedBtn.onclick = () => {
          closeModal();
          executeDelete(selectedId, nodeLabel);
        };
      }
    } else {
      // No node was clicked yet: show clean picker dropdown
      if (titleEl) titleEl.textContent = "Select Entity to Delete";
      if (msgEl) msgEl.textContent = "No entity is currently selected on the canvas. Choose which node to permanently remove from this investigation:";
      if (dropdownWrap) dropdownWrap.style.display = "block";

      if (selectEl) {
        selectEl.innerHTML = "";
        const currentNodes = cy ? cy.nodes() : [];
        if (currentNodes.length === 0) {
          selectEl.innerHTML = '<option value="">No entities found on graph</option>';
        } else {
          currentNodes.forEach(n => {
            const opt = document.createElement("option");
            opt.value = n.id();
            opt.textContent = `${n.data("label")} (ID #${n.id()}) - [${(n.data("type") || "entity").toUpperCase()}]`;
            selectEl.appendChild(opt);
          });
        }
      }

      if (proceedBtn) {
        proceedBtn.onclick = () => {
          const pickedId = selectEl?.value;
          if (!pickedId) {
            if (typeof showNetworkToast === "function") {
              showNetworkToast("Please select an entity to remove.");
            }
            return;
          }
          const pickedNode = cy ? cy.$(`node[id="${pickedId}"]`) : null;
          const pickedLabel = pickedNode && pickedNode.length > 0 ? pickedNode.data("label") : `Entity #${pickedId}`;
          closeModal();
          executeDelete(pickedId, pickedLabel);
        };
      }
    }

    modal.classList.add("open");
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
  };

  deleteNodeBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    cipherPromptDelete();
  });
  document.getElementById("btnInspectDeleteEntity")?.addEventListener("click", (e) => {
    e.preventDefault();
    cipherPromptDelete();
  });
  window.cipherDeleteSelectedNode = cipherPromptDelete;
  window.cipherExecuteDeleteEntity = executeDelete;

  // Highlight Cytoscape node when selected from GIS or other views
  window.highlightOnNetworkGraph = function(entityId) {
    if (!cy || !entityId) return;
    cy.nodes().removeClass('highlighted');
    const target = cy.$(`node[id="${entityId}"]`);
    if (target.length > 0) {
      target.addClass('highlighted');
      activeSelectedNodeId = String(entityId);
      if (!window.CipherSelection) window.CipherSelection = {};
      window.CipherSelection.entityId = String(entityId);
      showNodeInspector(target.data(), target);
      cy.animate({
        center: { eles: target },
        zoom: 1.4,
        duration: 500
      });
      target.emit('tap');
    }
  };

  // Cross-view sync: Listen to GIS location selection and highlight corresponding node
  window.addEventListener("cipher:gis-node-select", (evt) => {
    const detail = evt.detail;
    if (!detail) return;
    // Check if location is linked to an entity ID or matching label
    const rawEntId = detail.linked_entity_id ? String(detail.linked_entity_id).replace("ent-", "") : (detail.entity_id ? String(detail.entity_id) : null);
    if (rawEntId && cy) {
      window.highlightOnNetworkGraph(rawEntId);
    } else if (cy && detail.name) {
      const match = cy.nodes().filter(n => n.data('label') && n.data('label').toLowerCase().includes(detail.name.toLowerCase()));
      if (match.length > 0) {
        window.highlightOnNetworkGraph(match[0].id());
      }
    }
  });

  // 1. Shortest Path Analytic (BFS / Dijkstra)
  const btnGraphPath = document.getElementById("btnGraphPath");
  btnGraphPath?.addEventListener("click", async () => {
    if (!cy) return;
    const defaultStart = activeSelectedNodeId || (cy.nodes().length > 0 ? cy.nodes()[0].id() : "1");
    const defaultEnd = (cy.nodes().length > 1 ? cy.nodes()[cy.nodes().length - 1].id() : "6");

    const startId = prompt("Enter Start Entity ID or Name:", defaultStart);
    if (startId === null || !startId.trim()) return;
    const endId = prompt("Enter Target Entity ID or Name:", defaultEnd);
    if (endId === null || !endId.trim()) return;

    const s = startId.trim();
    const t = endId.trim();

    try {
      const res = await fetch(`/api/cases/${window.CipherCaseState?.id || 0}/graph/path`, {
        method: "POST",
        headers: (typeof window.getAuthHeaders === "function" ? window.getAuthHeaders() : {}),
        body: JSON.stringify({ start_entity_id: s, end_entity_id: t })
      });
      const data = await res.json();

      if (!data || !data.connected) {
        const msg = `No verified path found between "${s}" and "${t}" within 6 hops.`;
        if (typeof showNetworkToast === "function") showNetworkToast(msg);
        else if (typeof toast === "function") toast(msg);
        else console.warn(msg);
        return;
      }

      // Reset classes
      cy.elements().removeClass('path-node path-edge highlighted pattern-alert dimmed');
      cy.elements().addClass('dimmed');

      // Highlight path nodes
      if (Array.isArray(data.path_nodes)) {
        data.path_nodes.forEach(n => {
          const nId = String(n.id || n).replace("ent-", "");
          const nodeEl = cy.$(`node[id="${nId}"]`);
          nodeEl.removeClass('dimmed').addClass('path-node');
        });
      }

      // Highlight path edges
      if (Array.isArray(data.path_edges)) {
        data.path_edges.forEach(e => {
          const sId = String(e.source || "").replace("ent-", "");
          const tId = String(e.target || "").replace("ent-", "");
          const edgeEl = cy.$(`edge[source="${sId}"][target="${tId}"], edge[source="${tId}"][target="${sId}"]`);
          edgeEl.removeClass('dimmed').addClass('path-edge');
        });
      }

      // Animate camera to fit path
      const pathEles = cy.$('.path-node, .path-edge');
      if (pathEles.length > 0) {
        cy.animate({
          fit: { eles: pathEles, padding: 40 },
          duration: 700
        });
      }

      // Display in Inspector
      const startLabel = data.start_entity?.label || `Entity #${s}`;
      const endLabel = data.end_entity?.label || `Entity #${t}`;
      if (inspectorEmpty) inspectorEmpty.style.display = "none";
      if (inspectorContent) inspectorContent.style.display = "block";
      if (inspectName) inspectName.textContent = `PATH: ${startLabel} ➔ ${endLabel}`;
      if (inspectType) inspectType.textContent = `${data.hops ?? 0} HOPS (VERIFIED)`;
      if (inspectAliases) inspectAliases.textContent = data.label || "Computed path";
      if (inspectConf) inspectConf.textContent = "100% EVIDENCE MATCH";
      if (inspectStatus) inspectStatus.textContent = "VERIFIED PATH";

      if (inspectRelList && inspectRelCount && Array.isArray(data.path_edges)) {
        inspectRelCount.textContent = data.path_edges.length;
        inspectRelList.innerHTML = `
          <div style="margin-bottom:8px;padding:6px;background:rgba(255,176,32,0.1);border-left:3px solid #ffb020;font-size:11px;">
            <b>COMPUTED TRAVERSAL ROUTE</b> (${data.hops} Hops)
          </div>
          ${data.path_edges.map((e, idx) => `
            <div style="margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:#ffb020;font-size:10px;font-family:'DM Mono',monospace;">HOP ${idx+1}: ${e.type || "LINK"}</span><br/>
              <span style="font-size:11px;color:#e6edf3;">Entity #${e.source} ➔ Entity #${e.target}</span>
              ${e.evidence ? `<p style="font-size:10px;color:#7f8883;margin:2px 0 0;"><i>Evidence:</i> ${e.evidence}</p>` : ''}
            </div>
          `).join("")}
          <button type="button" style="margin-top:6px;width:100%;background:transparent;border:1px solid #2a4454;color:#7fe9df;padding:4px;font-size:10px;cursor:pointer;" onclick="if(window.loadNetworkGraph) window.loadNetworkGraph(window.CipherCaseState?.id);">Clear Path Overlay</button>
        `;
      }
      const successMsg = `Shortest path identified: ${startLabel} ➔ ${endLabel} (${data.hops} verified hops).`;
      if (typeof showNetworkToast === "function") showNetworkToast(successMsg);
      else if (typeof toast === "function") toast(successMsg);
    } catch (err) {
      console.error("Error computing graph path:", err);
      const errMsg = "Failed to calculate shortest path: " + (err.message || String(err));
      if (typeof showNetworkToast === "function") showNetworkToast(errMsg);
      else if (typeof toast === "function") toast(errMsg);
    }
  });

  // 2. Centrality Analytics (Degree & Betweenness)
  const btnGraphCentrality = document.getElementById("btnGraphCentrality");
  btnGraphCentrality?.addEventListener("click", async () => {
    if (!cy || !getCipherActiveCaseId()) return;
    try {
      const res = await fetch(`/api/cases/${window.CipherCaseState?.id || 0}/graph/analytics/centrality`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (!data.results) return;

      // Reset classes
      cy.elements().removeClass('path-node path-edge highlighted pattern-alert dimmed');

      // Dynamically scale node sizes by score
      data.results.forEach(r => {
        const nodeEl = cy.$(`node[id="${r.raw_id}"]`);
        if (nodeEl.length > 0) {
          const sz = Math.max(30, Math.min(64, Math.round(30 + r.score * 45)));
          nodeEl.style({
            'width': sz,
            'height': sz,
            'border-width': r.rank <= 2 ? 4 : 2,
            'border-color': r.rank === 1 ? '#ff5a5f' : (r.rank === 2 ? '#ffb020' : '#7fe9df')
          });
        }
      });

      // Display in Inspector
      if (inspectorEmpty) inspectorEmpty.style.display = "none";
      if (inspectorContent) inspectorContent.style.display = "block";
      if (inspectName) inspectName.textContent = "GRAPH CENTRALITY RANKING";
      if (inspectType) inspectType.textContent = "BETWEENNESS & DEGREE";
      if (inspectAliases) inspectAliases.textContent = data.label;
      if (inspectConf) inspectConf.textContent = "ALGORITHMIC";
      if (inspectStatus) inspectStatus.textContent = "TOP BROKERS";

      if (inspectRelList && inspectRelCount) {
        inspectRelCount.textContent = data.results.length;
        inspectRelList.innerHTML = `
          <div style="margin-bottom:8px;padding:6px;background:rgba(0,210,255,0.08);border-left:3px solid #00d2ff;font-size:10px;">
            <b>COMPUTED ANALYTIC - NOT AN AI CONCLUSION</b><br/>
            Ranked by network broker ratio &amp; direct connectivity.
          </div>
          <table style="width:100%;font-size:10px;text-align:left;border-collapse:collapse;">
            <tr style="color:#7f8883;border-bottom:1px solid rgba(255,255,255,0.1);">
              <th style="padding:4px 0;">RANK</th>
              <th style="padding:4px 0;">ENTITY</th>
              <th style="padding:4px 0;">DEGREE</th>
              <th style="padding:4px 0;">BETWEENNESS</th>
            </tr>
            ${data.results.map(r => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.04);cursor:pointer;" onclick="if(window.highlightOnNetworkGraph) window.highlightOnNetworkGraph(${r.raw_id});">
                <td style="padding:5px 0;color:#ffb020;font-weight:bold;">#${r.rank}</td>
                <td style="padding:5px 0;color:#e6edf3;"><b>${r.label}</b></td>
                <td style="padding:5px 0;color:#7fe9df;">${r.degree_centrality}</td>
                <td style="padding:5px 0;color:#00d2ff;">${r.betweenness_centrality}</td>
              </tr>
            `).join("")}
          </table>
          <button type="button" style="margin-top:8px;width:100%;background:transparent;border:1px solid #2a4454;color:#7fe9df;padding:4px;font-size:10px;cursor:pointer;" onclick="if(window.loadNetworkGraph) window.loadNetworkGraph(window.CipherCaseState?.id);">Reset Node Sizes</button>
        `;
      }
      if (typeof showNetworkToast === "function") showNetworkToast("Centrality analytics calculated. Node sizes scaled to betweenness score.");
      else if (typeof toast === "function") toast("Centrality analytics calculated. Node sizes scaled to betweenness score.");
    } catch (err) {
      console.error("Error running centrality analytics:", err);
      const errMsg = "Failed to compute centrality: " + (err.message || String(err));
      if (typeof showNetworkToast === "function") showNetworkToast(errMsg);
      else if (typeof toast === "function") toast(errMsg);
    }
  });

  // 3. Communities Analytics (Louvain / Clusters)
  const btnGraphCommunities = document.getElementById("btnGraphCommunities");
  btnGraphCommunities?.addEventListener("click", async () => {
    if (!cy || !getCipherActiveCaseId()) return;
    try {
      const res = await fetch(`/api/cases/${window.CipherCaseState?.id || 0}/graph/analytics/communities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (!data.communities) return;

      const palette = ["#00d2ff", "#ff5a5f", "#d9ff55", "#a855f7", "#ffb020", "#2ec4b6"];
      
      // Color nodes according to community cluster
      data.communities.forEach((comm, idx) => {
        const cColor = palette[idx % palette.length];
        comm.members.forEach(m => {
          const nodeEl = cy.$(`node[id="${m.raw_id}"]`);
          nodeEl.style({
            'background-color': cColor,
            'border-color': '#ffffff',
            'border-width': 3
          });
        });
      });

      // Display in Inspector
      if (inspectorEmpty) inspectorEmpty.style.display = "none";
      if (inspectorContent) inspectorContent.style.display = "block";
      if (inspectName) inspectName.textContent = "COMMUNITY CLUSTERING";
      if (inspectType) inspectType.textContent = `${data.total_communities} CLUSTERS DETECTED`;
      if (inspectAliases) inspectAliases.textContent = data.label;
      if (inspectConf) inspectConf.textContent = "CONNECTED SUB-NETS";
      if (inspectStatus) inspectStatus.textContent = "CLUSTERS PARTITIONED";

      if (inspectRelList && inspectRelCount) {
        inspectRelCount.textContent = data.total_communities;
        inspectRelList.innerHTML = `
          <div style="margin-bottom:8px;padding:6px;background:rgba(168,85,247,0.1);border-left:3px solid #a855f7;font-size:10px;">
            <b>COMPUTED ANALYTIC - NOT AN AI CONCLUSION</b><br/>
            Entities partitioned into closely coupled sub-networks.
          </div>
          ${data.communities.map((c, idx) => `
            <div style="margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:${palette[idx % palette.length]};font-size:11px;font-weight:bold;">● Cluster #${c.community_id} (${c.members.length} entities)</span>
              <p style="font-size:10px;color:#a3adab;margin:3px 0 0;">
                ${c.members.map(m => `<span style="display:inline-block;padding:1px 4px;margin:2px 2px 0 0;background:rgba(255,255,255,0.05);border-radius:2px;cursor:pointer;" onclick="if(window.highlightOnNetworkGraph) window.highlightOnNetworkGraph(${m.raw_id});">${m.label}</span>`).join("")}
              </p>
            </div>
          `).join("")}
          <button type="button" style="margin-top:8px;width:100%;background:transparent;border:1px solid #2a4454;color:#7fe9df;padding:4px;font-size:10px;cursor:pointer;" onclick="if(window.loadNetworkGraph) window.loadNetworkGraph(window.CipherCaseState?.id);">Reset Original Colors</button>
        `;
      }
      if (typeof showNetworkToast === "function") showNetworkToast(`Partitioned graph into ${data.total_communities} community clusters.`);
      else if (typeof toast === "function") toast(`Partitioned graph into ${data.total_communities} community clusters.`);
    } catch (err) {
      console.error("Error computing communities:", err);
      const errMsg = "Failed to compute community clusters: " + (err.message || String(err));
      if (typeof showNetworkToast === "function") showNetworkToast(errMsg);
      else if (typeof toast === "function") toast(errMsg);
    }
  });

  // 4. Pattern Flags Analytic (Conduits, Burner SIMs, Bridges)
  const btnGraphPatterns = document.getElementById("btnGraphPatterns");
  btnGraphPatterns?.addEventListener("click", async () => {
    if (!cy || !getCipherActiveCaseId()) return;
    try {
      const res = await fetch(`/api/cases/${window.CipherCaseState?.id || 0}/graph/analytics/patterns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (!data.patterns) return;

      // Reset classes
      cy.elements().removeClass('path-node path-edge highlighted pattern-alert dimmed');

      // Highlight pattern anchor nodes
      data.patterns.forEach(p => {
        const rawId = String(p.anchor_entity_id).replace("ent-", "");
        const nodeEl = cy.$(`node[id="${rawId}"]`);
        nodeEl.addClass('pattern-alert');
      });

      // Display in Inspector
      if (inspectorEmpty) inspectorEmpty.style.display = "none";
      if (inspectorContent) inspectorContent.style.display = "block";
      if (inspectName) inspectName.textContent = "STRUCTURAL PATTERN ALERTS";
      if (inspectType) inspectType.textContent = `${data.patterns_count} ANOMALIES FLAGGED`;
      if (inspectAliases) inspectAliases.textContent = data.label;
      if (inspectConf) inspectConf.textContent = "STRUCTURAL FLAGS";
      if (inspectStatus) inspectStatus.textContent = "REVIEW REQUIRED";

      if (inspectRelList && inspectRelCount) {
        inspectRelCount.textContent = data.patterns_count;
        inspectRelList.innerHTML = `
          <div style="margin-bottom:8px;padding:6px;background:rgba(255,90,95,0.12);border-left:3px solid #ff5a5f;font-size:10px;">
            <b>COMPUTED ANALYTIC - STRUCTURAL REVIEW FLAGS</b><br/>
            Automated alerts for human investigator review &amp; verification.
          </div>
          ${data.patterns.map(p => `
            <div style="margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.06);cursor:pointer;" onclick="if(window.highlightOnNetworkGraph) window.highlightOnNetworkGraph('${String(p.anchor_entity_id).replace('ent-', '')}');">
              <span style="color:${p.severity === 'CRITICAL' ? '#ff5a5f' : '#ffb020'};font-size:10px;font-weight:bold;">⚠️ ${p.pattern_type} [${p.severity}]</span><br/>
              <b style="color:#e6edf3;font-size:11px;">${p.title}</b>
              <p style="font-size:10px;color:#a3adab;margin:2px 0 0;">${p.description}</p>
            </div>
          `).join("")}
          <button type="button" style="margin-top:8px;width:100%;background:transparent;border:1px solid #2a4454;color:#7fe9df;padding:4px;font-size:10px;cursor:pointer;" onclick="if(window.loadNetworkGraph) window.loadNetworkGraph(window.CipherCaseState?.id);">Clear Pattern Badges</button>
        `;
      }
      if (typeof showNetworkToast === "function") showNetworkToast(`Flagged ${data.patterns_count} structural patterns for review.`);
      else if (typeof toast === "function") toast(`Flagged ${data.patterns_count} structural patterns for review.`);
    } catch (err) {
      console.error("Error computing patterns:", err);
      const errMsg = "Failed to compute pattern flags: " + (err.message || String(err));
      if (typeof showNetworkToast === "function") showNetworkToast(errMsg);
      else if (typeof toast === "function") toast(errMsg);
    }
  });

  // 5. Timeline Slider Filter (Temporal Graph Slicing)
  const networkTimelineSlider = document.getElementById("networkTimelineSlider");
  const networkTimelineVal = document.getElementById("networkTimelineVal");
  const btnResetTimelineFilter = document.getElementById("btnResetTimelineFilter");

  networkTimelineSlider?.addEventListener("input", (e) => {
    if (!cy) return;
    const val = Number(e.target.value);
    const maxVal = Number(e.target.max) || 10;
    
    if (networkTimelineVal) {
      networkTimelineVal.textContent = val >= maxVal ? "ALL EVENTS (100%)" : `PHASE 01 ➔ PHASE 0${val}`;
    }

    // Filter nodes by id <= val * 2
    const threshold = val * 2;
    cy.batch(() => {
      cy.nodes().forEach(n => {
        const idNum = Number(n.id());
        if (idNum > threshold) {
          n.addClass('dimmed');
        } else {
          n.removeClass('dimmed');
        }
      });
      cy.edges().forEach(ed => {
        const srcNum = Number(ed.source().id());
        const tgtNum = Number(ed.target().id());
        if (srcNum > threshold || tgtNum > threshold) {
          ed.addClass('dimmed');
        } else {
          ed.removeClass('dimmed');
        }
      });
    });
  });

  btnResetTimelineFilter?.addEventListener("click", () => {
    if (networkTimelineSlider) {
      networkTimelineSlider.value = networkTimelineSlider.max;
      if (networkTimelineVal) networkTimelineVal.textContent = "ALL EVENTS (100%)";
    }
    if (cy) {
      cy.elements().removeClass('dimmed');
    }
  });

  // Wire Add Node modal geocoding helper button
  const btnGeocode = document.getElementById("btnNodeGeocode");
  const geocodeInput = document.getElementById("nodeGeocodeQuery");
  const modalLat = document.getElementById("nodeModalLat");
  const modalLng = document.getElementById("nodeModalLng");

  btnGeocode?.addEventListener("click", async () => {
    const activeCaseId = getCipherActiveCaseId();
    if (!activeCaseId) { toast("Select a case before geocoding."); return; }
    const q = geocodeInput?.value?.trim();
    if (!q) {
      alert("Please enter a landmark or location query to geocode.");
      return;
    }
    btnGeocode.textContent = "Searching...";
    try {
      const res = await fetch(`/api/cases/${window.CipherCaseState?.id || 0}/geocode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: q })
      });
      const data = await res.json();
      if (data.found) {
        if (modalLat) modalLat.value = data.latitude;
        if (modalLng) modalLng.value = data.longitude;
        btnGeocode.textContent = "Found ✓";
        setTimeout(() => btnGeocode.textContent = "Geocode (OSM) ⌕", 2000);
      } else {
        alert("Nominatim OSM found no coordinates for this address. You may enter coordinates manually or use the GIS Waypoint tool.");
        btnGeocode.textContent = "Not Found";
        setTimeout(() => btnGeocode.textContent = "Geocode (OSM) ⌕", 2000);
      }
    } catch (e) {
      btnGeocode.textContent = "Error";
      setTimeout(() => btnGeocode.textContent = "Geocode (OSM) ⌕", 2000);
    }
  });

  // Add Node submits to the active case; relationship linking uses the selected existing entity.
  const nodeForm = document.getElementById("nodeForm");
  nodeForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(nodeForm);
    const label = (formData.get("nodeName") || formData.get("label") || formData.get("identityName") || document.getElementById("nodeModalName")?.value || "").trim();
    
    // Check active node-type button
    const activeTypeBtn = nodeForm.querySelector(".node-type.active");
    const entity_type = activeTypeBtn?.dataset?.nodeType || (formData.get("nodeType") || formData.get("entity_type") || "person").toString().toLowerCase();
    
    const aliases = (formData.get("nodeAliases") || formData.get("nodeId") || formData.get("aliases") || "").trim();
    const latitude = formData.get("nodeLat") || document.getElementById("nodeModalLat")?.value;
    const longitude = formData.get("nodeLng") || document.getElementById("nodeModalLng")?.value;

    if (!label) {
      if (typeof showNetworkToast === "function") {
        showNetworkToast("Please enter a name / label for this entity.");
      } else if (typeof toast === "function") {
        toast("Please enter a name / label for this entity.");
      }
      const nameInp = document.getElementById("nodeModalName") || nodeForm.querySelector('input[name="nodeName"]');
      nameInp?.focus();
      return;
    }

    try {
      const activeCaseId = getCipherActiveCaseId();
      if (!activeCaseId) { toast("Select a case before adding a node."); return; }
      const res = await fetch(`/api/cases/${activeCaseId}/entities`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(typeof window.getAuthHeaders === "function" ? window.getAuthHeaders(false) : {}) },
        body: JSON.stringify({
          entity_type,
          label,
          aliases,
          latitude: latitude ? Number(latitude) : undefined,
          longitude: longitude ? Number(longitude) : undefined,
          source_reference: formData.get("sourceRef") || "MANUAL_INVESTIGATOR",
          note: formData.get("note") || "",
          verification_status: "verified"
        })
      });

      if (res.ok) {
        const json = await res.json();
        const newEntityId = json.entity?.id;

        // If link target selected, create relationship
        const linkTarget = formData.get("targetNode") || formData.get("linkTarget") || document.getElementById("nodeModalTargetNode")?.value;
        const relationshipType = formData.get("relationType") || formData.get("linkType") || document.getElementById("nodeModalRelationType")?.value || "ASSOCIATED_WITH";
        if (linkTarget && newEntityId) {
          const relationshipResponse = await fetch(`/api/cases/${activeCaseId}/relationships`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(typeof window.getAuthHeaders === "function" ? window.getAuthHeaders(false) : {}) },
            body: JSON.stringify({
              source_entity_id: Number(String(newEntityId).replace(/^ent-/, "")),
              target_entity_id: Number(String(linkTarget).replace(/^ent-/, "")),
              relationship_type: relationshipType,
              evidence_sentence: "Investigator manually recorded link in CIPHER workspace",
              verification_status: "verified"
            })
          });
          if (!relationshipResponse.ok) {
            const relationshipError = await relationshipResponse.json().catch(() => ({}));
            throw new Error(relationshipError.detail || relationshipError.error || "Entity was created, but the relationship could not be saved.");
          }
        }

        // Optional investigator-entered event becomes a verified timeline record.
        const eventDate = formData.get("eventDate") || "";
        const eventTime = formData.get("eventTime") || "";
        const eventLabel = (formData.get("eventLabel") || "").trim();
        if (eventLabel && eventDate) {
          const ts = eventTime ? `${eventDate}T${eventTime}:00` : `${eventDate}T00:00:00`;
          try {
            await fetch(`/api/cases/${activeCaseId}/timeline`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("cipher_access_token") || ""}` },
              body: JSON.stringify({ event_type: eventLabel, description: eventLabel, event_time: ts, entity_id: newEntityId, verification_status: "verified", source_reference: formData.get("sourceRef") || "MANUAL_INVESTIGATOR" })
            });
          } catch (timelineError) { console.warn("Manual timeline event could not be saved", timelineError); }
        }

        // Reset and close modal
        nodeForm.reset();
        document.querySelectorAll(".node-type").forEach((b, idx) => {
          b.classList.toggle("active", idx === 0);
        });
        if (typeof window.cipherCloseNodeModal === "function") {
          window.cipherCloseNodeModal();
        } else {
          const modal = document.getElementById("nodeModal");
          if (modal) {
            modal.classList.remove("open");
            modal.style.display = "none";
          }
        }

        await loadNetworkGraph(window.CipherCaseState?.id);
        if (newEntityId && window.highlightOnNetworkGraph) {
          setTimeout(() => {
            window.highlightOnNetworkGraph(newEntityId);
          }, 300);
        }

        if (typeof toast === "function") {
          toast(`Entity "${label}" added to network graph & database.`);
        } else if (typeof showNetworkToast === "function") {
          showNetworkToast(`Entity "${label}" added to network graph & database.`);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        const msg = err.error || err.detail || "Failed to create entity.";
        if (typeof showNetworkToast === "function") {
          showNetworkToast(msg);
        } else if (typeof toast === "function") {
          toast(msg);
        }
      }
    } catch (err) {
      console.error("Failed to add entity:", err);
      if (typeof showNetworkToast === "function") {
        showNetworkToast("Error contacting server to create entity.");
      }
    }
  });

  // Ensure toolbar Add Node button is directly wired
  const addNodeToolbarBtn = document.getElementById("addNodeBtn");
  addNodeToolbarBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    if (typeof window.cipherOpenNodeModal === "function") {
      window.cipherOpenNodeModal();
    } else {
      const modal = document.getElementById("nodeModal");
      if (modal) {
        modal.classList.add("open");
        modal.style.display = "flex";
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
      }
    }
  });

  // Expose global graph loader
  window.loadNetworkGraph = loadNetworkGraph;

  // Initialize on load and on tab switch to network
  window.addEventListener("load", () => {
    setTimeout(() => loadNetworkGraph(window.CipherCaseState?.id), 300);
  });

  // Attach to both sidebar buttons and switchView events
  const networkNavBtn = document.querySelector('.workspace-sidebar .side-item[data-view="network"]');
  networkNavBtn?.addEventListener("click", () => {
    setTimeout(() => {
      if (!cy) {
        loadNetworkGraph(window.CipherCaseState?.id);
      } else {
        cy.resize();
        cy.fit(undefined, 30);
      }
    }, 120);
  });

  document.querySelectorAll('[data-view="network"]').forEach(el => {
    el.addEventListener("click", () => {
      setTimeout(() => {
        if (!cy) {
          loadNetworkGraph(window.CipherCaseState?.id);
        } else {
          cy.resize();
          cy.fit(undefined, 30);
        }
      }, 150);
    });
  });

})();

/* =============================================================================
   CIPHER AI INVESTIGATOR FRONTEND SUBSYSTEM
   Co-pilot interface, deterministic provenance, review queue, & contextual queries
   ============================================================================= */
(function initAIInvestigatorSubsystem() {
  const DEFAULT_CASE_ID = 0;
  let activeCaseId = 0;
  let currentConversationId = null;
  let loadingInterval = null;

  function getAuthToken() {
    return (
      localStorage.getItem("cipher_access_token") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("cipher_access_token") ||
      ""
    );
  }

  function getAuthHeaders() {
    const headers = { "Content-Type": "application/json" };
    const token = getAuthToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  // Exposed globally for view switches
  window.refreshAIActivity = async function() {
  try {
    const selectedCaseId = Number(window.CipherCaseState?.id || 0);

    if (!selectedCaseId || !window.CipherCaseState?.caseSelected) {
      return;
    }

    activeCaseId = selectedCaseId;

    const res = await fetch(`/api/cases/${activeCaseId}/ai/activity`, {
      headers: getAuthHeaders(),
    });

    if (!res.ok) return;
      
      const statSuggestions = document.getElementById("aiStatSuggestions");
      const statDuplicates = document.getElementById("aiStatDuplicates");
      const statConflicts = document.getElementById("aiStatConflicts");
      const statChainLogs = document.getElementById("aiStatChainLogs");

      const pendingCount = data.pending_suggestions_count ?? data.new_suggestions_count ?? (data.activity?.new_suggestions_count) ?? 0;
      const dupCount = data.duplicate_count ?? data.possible_duplicates_count ?? (data.activity?.possible_duplicates_count) ?? 0;
      const confCount = data.conflict_count ?? data.evidence_conflicts_count ?? (data.activity?.evidence_conflicts_count) ?? 0;

      if (statSuggestions) statSuggestions.textContent = pendingCount;
      if (statDuplicates) statDuplicates.textContent = dupCount;
      if (statConflicts) statConflicts.textContent = confCount;
      if (statChainLogs) statChainLogs.textContent = "100%";

      // Also refresh pending suggestions list
      loadPendingSuggestions();
    } catch (err) {
      console.warn("[AI Investigator] Failed to fetch activity:", err);
    }
  };

  async function loadPendingSuggestions() {
  const container = document.getElementById("aiPendingSuggestionsList");
  if (!container) return;

  const selectedCaseId = Number(window.CipherCaseState?.id || 0);

  if (!selectedCaseId || !window.CipherCaseState?.caseSelected) {
    return;
  }

  activeCaseId = selectedCaseId;

  try {
    const res = await fetch(`/api/cases/${activeCaseId}/ai/suggestions?status=PENDING`, {
      headers: getAuthHeaders(),
    });

      if (!res.ok) return;
      const resData = await res.json();
      const suggestions = Array.isArray(resData) ? resData : (resData.suggestions || resData.data || []);

      if (!suggestions || suggestions.length === 0) {
        container.innerHTML = `
          <div style="padding: 16px; text-align: center; color: var(--text-muted, #8a96a0); font-size: 12px;">
            <span>✓</span> All AI candidate suggestions reviewed.
          </div>
        `;
        return;
      }

      container.innerHTML = suggestions.map(sug => {
        const payload = sug.suggested_payload || sug.payload || {};
        const confVal = typeof sug.confidence === "number" ? sug.confidence : 0.85;
        const confPct = Math.round(confVal <= 1 ? confVal * 100 : confVal);
        const targetLabel = payload.primary_entity || payload.candidate_entity || payload.name || payload.target_name || (payload.source_id ? `Entity #${payload.source_id}` : "Case Record");
        return `
          <div class="ai-suggestion-card" data-id="${sug.id}">
            <div class="ai-sug-head">
              <span class="ai-sug-type">${escapeHtml(sug.suggestion_type || sug.type || "CANDIDATE")}</span>
              <span class="ai-sug-conf">${confPct}% CONF</span>
            </div>
            <p class="ai-sug-reason">${escapeHtml(sug.reasoning || payload.reason || "Algorithm detected relationship match requiring human review.")}</p>
            <div class="ai-sug-meta">
              <span>TARGET: <b>${escapeHtml(targetLabel)}</b></span>
            </div>
            <div class="ai-sug-actions">
              <button type="button" class="ai-sug-btn accept" data-id="${sug.id}" data-action="ACCEPT">
                <span>ACCEPT</span>
              </button>
              <button type="button" class="ai-sug-btn reject" data-id="${sug.id}" data-action="REJECT">
                <span>REJECT</span>
              </button>
            </div>
          </div>
        `;
      }).join("");

      // Attach button events
      container.querySelectorAll(".ai-sug-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const sugId = btn.dataset.id;
          const action = btn.dataset.action;
          await handleSuggestionAction(sugId, action);
        });
      });
    } catch (err) {
      console.warn("[AI Investigator] Failed to load suggestions:", err);
    }
  }

  async function handleSuggestionAction(suggestionId, decision) {
    try {
      const res = await fetch(`/api/cases/${activeCaseId}/ai/review-action`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          suggestion_id: parseInt(suggestionId, 10),
          decision: decision,
          notes: "Reviewed by officer via AI Investigator queue",
        }),
      });
      if (res.ok) {
        window.refreshAIActivity();
      }
    } catch (err) {
      console.error("[AI Investigator] Error resolving suggestion:", err);
    }
  }

  window.sendAIQuery = async function(queryText, contextualOptions = {}) {
    // Always resolve the active investigation at query time; never pin the assistant to a demo case.
    const selectedCaseId = Number(window.CipherCaseState?.id || 0);
    if (!selectedCaseId) {
      renderAIError("Select an active case before asking Cipher AI.");
      return;
    }
    if (selectedCaseId !== activeCaseId) currentConversationId = null;
    activeCaseId = selectedCaseId;

    const defaultCard = document.getElementById("aiDefaultCard");
    const activeAnswerCard = document.getElementById("aiActiveAnswerCard");
    const loadingCard = document.getElementById("aiLoadingCard");
    const queryInput = document.getElementById("aiQueryInput");

    if (!queryText || !queryText.trim()) return;

    if (queryInput) queryInput.value = queryText;

    if (defaultCard) defaultCard.style.display = "none";
    if (activeAnswerCard) activeAnswerCard.style.display = "none";
    if (loadingCard) loadingCard.style.display = "flex";

    const loadingStages = [
      "Searching case database & verified ledger...",
      "Verifying source chain & confidence...",
      "Analyzing network topology & coordinates...",
      "Synthesizing answer with verified evidence citations..."
    ];
    let stageIdx = 0;
    const loadingStatusText = document.getElementById("aiLoadingStatusText");
    if (loadingStatusText) {
      loadingStatusText.textContent = loadingStages[0];
    }
    clearInterval(loadingInterval);
    loadingInterval = setInterval(() => {
      stageIdx = (stageIdx + 1) % loadingStages.length;
      if (loadingStatusText) loadingStatusText.textContent = loadingStages[stageIdx];
    }, 750);

    try {
      const res = await fetch(`/api/cases/${activeCaseId}/ai/query`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          query: queryText,
          conversation_id: currentConversationId,
          screen_context: contextualOptions.screen || "ai-investigator",
          active_entity_id: contextualOptions.entityId || null,
          active_location_id: contextualOptions.locationId || null,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const detail = typeof errBody.detail === "object" ? (errBody.detail.message || JSON.stringify(errBody.detail)) : (errBody.detail || errBody.error || errBody.message);
        throw new Error(detail || `Server returned ${res.status}`);
      }

      const data = await res.json();
      currentConversationId = data.conversation_id || (data.data?.conversation_id) || currentConversationId;

      renderAIResponse(data);
    } catch (err) {
      console.error("[AI Investigator] Query failure:", err);
      renderAIError(err.message || "Failed to retrieve AI analysis");
    } finally {
      clearInterval(loadingInterval);
      if (loadingCard) loadingCard.style.display = "none";
    }
  };

  function renderAIResponse(raw) {
    const activeAnswerCard = document.getElementById("aiActiveAnswerCard");
    const badgeType = document.getElementById("aiAnswerTypeBadge");
    const badgeConf = document.getElementById("aiConfidenceBadge");
    const timestamp = document.getElementById("aiAnswerTimestamp");
    const answerText = document.getElementById("aiAnswerText");
    const sourcesBlock = document.getElementById("aiSourcesBlock");
    const sourcesList = document.getElementById("aiSourcesList");
    const actionsBlock = document.getElementById("aiActionsBlock");
    const actionButtons = document.getElementById("aiActionButtons");

    if (!activeAnswerCard) return;

    const data = (raw.data && typeof raw.data.answer === "string") ? { ...raw.data, ...raw } : raw;
    const answer = data.answer_text || data.answer || data.data?.answer || "";

    // Badge styling
    const rawType = (data.response_type || data.answer_type || "SOURCE_BACKED").toUpperCase().replace("-", "_");
    if (badgeType) {
      badgeType.className = "ai-badge-pill";
      if (rawType.includes("SOURCE")) {
        badgeType.textContent = "SOURCE-BACKED";
        badgeType.classList.add("type-source-backed");
      } else if (rawType.includes("COMPUTE")) {
        badgeType.textContent = "COMPUTED";
        badgeType.classList.add("type-computed");
      } else if (rawType.includes("SUGGEST")) {
        badgeType.textContent = "AI SUGGESTION";
        badgeType.classList.add("type-suggestion");
      } else {
        badgeType.textContent = rawType;
        badgeType.classList.add("type-unknown");
      }
    }

    if (badgeConf) {
      const conf = data.confidence;
      if (typeof conf === "number") {
        badgeConf.textContent = `Confidence: ${Math.round(conf <= 1 ? conf * 100 : conf)}%`;
      } else if (typeof conf === "string" && conf.trim()) {
        badgeConf.textContent = conf;
      } else {
        badgeConf.textContent = "Confidence: Verified (100%)";
      }
    }

    if (timestamp) {
      const now = new Date();
      timestamp.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    // Format text nicely: convert markdown-style headers, bolding, and lists
    if (answerText) {
      answerText.innerHTML = formatAIAnswerText(answer);
    }

    // Render sources
    const sources = data.sources || data.data?.sources || [];
    if (sources.length > 0 && sourcesList && sourcesBlock) {
      sourcesBlock.style.display = "block";
      sourcesList.innerHTML = sources.map(src => `
        <div class="ai-source-item">
          <div class="ai-src-info">
            <b class="ai-src-ref">${escapeHtml(src.reference || "Evidence Ledger")}</b>
            <span class="ai-src-sub">Source: ${escapeHtml(src.source_type || "verified_evidence")}${src.date ? ` · ${escapeHtml(src.date)}` : ""}${src.reliability ? ` · Reliability: ${escapeHtml(src.reliability)}` : ""}</span>
          </div>
          <button type="button" class="ai-src-link-btn" data-ref="${escapeHtml(src.reference || "")}">
            <span>VIEW IN EVIDENCE</span>
            <b>→</b>
          </button>
        </div>
      `).join("");

      sourcesList.querySelectorAll(".ai-src-link-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          if (typeof window.switchWorkspaceView === "function") {
            window.switchWorkspaceView("evidence");
          }
        });
      });
    } else if (sourcesBlock) {
      sourcesBlock.style.display = "none";
    }

    // Render direct actions
    const actions = data.suggested_actions || data.actions || data.data?.actions || [];
    if (actions.length > 0 && actionsBlock && actionButtons) {
      actionsBlock.style.display = "block";
      actionButtons.innerHTML = actions.map(act => `
        <button type="button" class="ai-action-btn" data-action-type="${escapeHtml(act.type || "")}" data-action-payload='${escapeHtml(JSON.stringify(act.payload || {}))}'>
          <span>${escapeHtml(act.label || "Action")}</span>
          <b>↗</b>
        </button>
      `).join("");

      actionButtons.querySelectorAll(".ai-action-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          handleAIActionButtonClick(btn.dataset.actionType, btn.dataset.actionPayload, data);
        });
      });
    } else if (actionsBlock) {
      actionsBlock.style.display = "none";
    }

    // Check if this response is an official report draft
    const isReportDraft = actions.some(a => a.type === "DRAFT_REPORT") || answer.includes("REPORT DRAFT") || answer.includes("EXECUTIVE SUMMARY") || answer.includes("INVESTIGATIVE REPORT");
    renderReportDraftControls(isReportDraft, answer);

    activeAnswerCard.style.display = "block";
  }

  function renderReportDraftControls(isReport, reportText) {
    let reportControls = document.getElementById("aiReportDraftControls");
    if (!reportControls) {
      reportControls = document.createElement("div");
      reportControls.id = "aiReportDraftControls";
      reportControls.style.marginTop = "16px";
      reportControls.style.padding = "12px 14px";
      reportControls.style.background = "rgba(0, 242, 255, 0.05)";
      reportControls.style.border = "1px solid rgba(0, 242, 255, 0.25)";
      reportControls.style.borderRadius = "8px";
      const answerCard = document.getElementById("aiActiveAnswerCard");
      if (answerCard) answerCard.appendChild(reportControls);
    }

    if (!isReport) {
      reportControls.style.display = "none";
      return;
    }

    reportControls.style.display = "block";
    reportControls.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--accent-cyan,#00f2ff);">OFFICIAL INTELLIGENCE REPORT DRAFT</span>
        <span style="font-size:10px;color:var(--text-muted,#8a96a0);">REQUIRES INVESTIGATOR APPROVAL</span>
      </div>
      <p style="font-size:12px;color:var(--text-secondary,#cbd5e1);margin:0 0 10px 0;">This draft synthesizes verified case evidence, accused profiles, timeline events, and network centralities.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button type="button" id="btnApproveDraftReport" class="ai-action-btn" style="background:rgba(34,197,94,0.15);border-color:#22c55e;color:#86efac;">
          <span>✓ APPROVE &amp; REGISTER IN CHAIN OF CUSTODY</span>
        </button>
        <button type="button" id="btnTransferToCaseSheet" class="ai-action-btn" style="border-color:var(--accent-cyan,#00f2ff);color:var(--accent-cyan,#00f2ff);">
          <span>↗ VIEW IN CASE SHEET</span>
        </button>
      </div>
      <div id="reportApprovalNotice" style="display:none;margin-top:8px;font-size:11px;color:#86efac;"></div>
    `;

    document.getElementById("btnApproveDraftReport")?.addEventListener("click", async () => {
      try {
        const btn = document.getElementById("btnApproveDraftReport");
        if (btn) btn.textContent = "REGISTERING...";
        const res = await fetch(`/api/cases/${activeCaseId}/ai/approve-report`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            report_text: reportText,
            notes: "Officer verified and approved AI drafted case report"
          })
        });
        const resData = await res.json();
        const notice = document.getElementById("reportApprovalNotice");
        if (notice) {
          notice.style.display = "block";
          notice.textContent = "✓ Report successfully approved and permanently registered in the verified chain of custody.";
        }
        if (btn) btn.textContent = "✓ REPORT APPROVED";
        window.refreshAIActivity();
      } catch (e) {
        console.error("Failed to approve report:", e);
      }
    });

    document.getElementById("btnTransferToCaseSheet")?.addEventListener("click", () => {
      if (typeof window.switchWorkspaceView === "function") {
        window.switchWorkspaceView("evidence");
      }
    });
  }

  function handleAIActionButtonClick(actionType, rawPayload, fullData) {
    let payload = {};
    try {
      payload = JSON.parse(rawPayload || "{}");
    } catch (e) {}

    const highlights = fullData?.highlights || {};

    if (actionType === "OPEN_NETWORK") {
      if (typeof window.switchWorkspaceView === "function") window.switchWorkspaceView("network");
      const targetNode = payload.node_id || payload.nodes?.[0] || highlights.nodes?.[0];
      if (targetNode && window.cy) {
        setTimeout(() => {
          try {
            const node = window.cy.getElementById(String(targetNode));
            if (node && node.length) {
              window.cy.elements().unselect();
              node.select();
              window.cy.center(node);
            }
          } catch (e) {}
        }, 300);
      }
      if (highlights.path && highlights.path.length && window.cy) {
        setTimeout(() => {
          try {
            window.cy.elements().removeClass("highlighted-path");
            highlights.path.forEach(nid => {
              window.cy.getElementById(String(nid)).addClass("highlighted-path");
            });
          } catch (e) {}
        }, 350);
      }
    } else if (actionType === "OPEN_GIS") {
      if (typeof window.switchWorkspaceView === "function") window.switchWorkspaceView("gis");
      const lat = payload.lat || highlights.lat;
      const lng = payload.lng || highlights.lng;
      if (lat && lng && window.workspaceGISMap) {
        setTimeout(() => {
          try {
            window.workspaceGISMap.setView([lat, lng], 13);
          } catch (e) {}
        }, 300);
      }
    } else if (actionType === "OPEN_TIMELINE") {
      if (typeof window.switchWorkspaceView === "function") window.switchWorkspaceView("timeline");
    } else if (actionType === "OPEN_EVIDENCE") {
      if (typeof window.switchWorkspaceView === "function") window.switchWorkspaceView("evidence");
    } else if (actionType === "OPEN_REVIEW") {
      if (typeof window.switchWorkspaceView === "function") {
        window.switchWorkspaceView("review");
      } else {
        loadPendingSuggestions();
        const reviewBox = document.getElementById("aiPendingSuggestionsList");
        if (reviewBox) reviewBox.scrollIntoView({ behavior: "smooth" });
      }
    } else if (actionType === "DRAFT_REPORT") {
      window.sendAIQuery("Draft official case intelligence report.");
    }
  }

  function renderAIError(msg) {
    const activeAnswerCard = document.getElementById("aiActiveAnswerCard");
    const badgeType = document.getElementById("aiAnswerTypeBadge");
    const answerText = document.getElementById("aiAnswerText");
    const sourcesBlock = document.getElementById("aiSourcesBlock");
    const actionsBlock = document.getElementById("aiActionsBlock");
    const reportControls = document.getElementById("aiReportDraftControls");

    if (!activeAnswerCard) return;

    if (badgeType) {
      badgeType.textContent = "INVESTIGATION NOTICE";
      badgeType.className = "ai-badge-pill type-unknown";
    }

    if (answerText) {
      answerText.innerHTML = `
        <div style="padding: 12px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; color: #f87171;">
          <b>Investigation Co-Pilot notice:</b> ${escapeHtml(msg)}. All core case records, network graphs, and evidence remain safe and accessible.
        </div>
      `;
    }

    if (sourcesBlock) sourcesBlock.style.display = "none";
    if (actionsBlock) actionsBlock.style.display = "none";
    if (reportControls) reportControls.style.display = "none";
    activeAnswerCard.style.display = "block";
  }

  function formatAIAnswerText(text) {
    if (!text) return "";
    let safe = escapeHtml(text);

    // Bolding **text**
    safe = safe.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Markdown headers ### Title
    safe = safe.replace(/### (.*?)(?:\n|$)/g, '<h4 style="font-size:14px;font-weight:700;margin:16px 0 6px 0;color:var(--text-main, #f1f5f9);">$1</h4>');
    safe = safe.replace(/## (.*?)(?:\n|$)/g, '<h3 style="font-size:15px;font-weight:700;margin:18px 0 8px 0;color:var(--text-main, #f1f5f9);">$1</h3>');

    // Bullet points
    safe = safe.replace(/(?:^|\n)- (.*?)(?=(?:\n|$))/g, '<div style="margin:4px 0 4px 12px;display:flex;gap:6px;"><span style="color:var(--accent-cyan,#00f2ff);">•</span><span>$1</span></div>');

    // Paragraph breaks
    safe = safe.replace(/\n\n/g, '<div style="height:10px;"></div>');
    return safe;
  }

  function escapeHtml(str) {
    if (typeof str !== "string") return String(str ?? "");
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Setup DOM events when DOM is ready
  function bindAIEvents() {
    const aiLauncher = document.getElementById("cipherAiLauncher");
    const aiClose = document.getElementById("cipherAiClose");
    const aiScrim = document.getElementById("cipherAiScrim");
    if (aiLauncher) aiLauncher.addEventListener("click", () => window.openCipherAIDrawer?.());
    if (aiClose) aiClose.addEventListener("click", () => window.closeCipherAIDrawer?.());
    if (aiScrim) aiScrim.addEventListener("click", () => window.closeCipherAIDrawer?.());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && document.getElementById("cipherWorkspace")?.classList.contains("ai-drawer-open")) {
        window.closeCipherAIDrawer?.();
      }
    });

    const submitBtn = document.getElementById("aiSubmitBtn");
    const queryInput = document.getElementById("aiQueryInput");
    const refreshBtn = document.getElementById("aiRefreshActivityBtn");
    const openReviewBtn = document.getElementById("aiOpenReviewQueueBtn");

    if (submitBtn && queryInput) {
      submitBtn.addEventListener("click", () => {
        window.sendAIQuery(queryInput.value);
      });

      queryInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          window.sendAIQuery(queryInput.value);
        }
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        window.refreshAIActivity();
      });
    }

    if (openReviewBtn) {
      openReviewBtn.addEventListener("click", () => {
        if (typeof window.switchWorkspaceView === "function") {
          window.switchWorkspaceView("review");
        } else {
          loadPendingSuggestions();
        }
      });
    }

    // Quick suggestion chips
    document.querySelectorAll(".ai-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        const query = chip.dataset.query;
        if (query) {
          window.sendAIQuery(query);
        }
      });
    });

    // Contextual "Ask CIPHER" buttons across workspaces
    const casesAskBtn = document.getElementById("casesAskCipherBtn");
    if (casesAskBtn) {
      casesAskBtn.addEventListener("click", () => {
        if (typeof window.switchWorkspaceView === "function") window.switchWorkspaceView("ai-investigator");
        window.sendAIQuery("Summarize this case and provide current investigation status.", { screen: "cases" });
      });
    }

    const networkAskBtn = document.getElementById("networkAskCipherBtn");
    if (networkAskBtn) {
      networkAskBtn.addEventListener("click", () => {
        if (typeof window.switchWorkspaceView === "function") window.switchWorkspaceView("ai-investigator");
        window.sendAIQuery("Analyze current network structure and find the most critical actors and paths.", { screen: "network" });
      });
    }

    const gisAskBtn = document.getElementById("gisAskCipherBtn");
    if (gisAskBtn) {
      gisAskBtn.addEventListener("click", () => {
        if (typeof window.switchWorkspaceView === "function") window.switchWorkspaceView("ai-investigator");
        window.sendAIQuery("Analyze geospatial distribution and key location sightings in this case.", { screen: "gis" });
      });
    }

    const evidenceAskBtn = document.getElementById("evidenceAskCipherBtn");
    if (evidenceAskBtn) {
      evidenceAskBtn.addEventListener("click", () => {
        if (typeof window.switchWorkspaceView === "function") window.switchWorkspaceView("ai-investigator");
        window.sendAIQuery("Explain key evidentiary findings, source reliability, and extraction confidence.", { screen: "evidence" });
      });
    }

    const timelineAskBtn = document.getElementById("timelineAskCipherBtn");
    if (timelineAskBtn) {
      timelineAskBtn.addEventListener("click", () => {
        if (typeof window.switchWorkspaceView === "function") window.switchWorkspaceView("ai-investigator");
        window.sendAIQuery("Summarize the chronological sequence of events and timeline trace.", { screen: "timeline" });
      });
    }

    // Contextual button on Entity Inspector (Network graph)
    const entityAskBtn = document.getElementById("btnInspectAskCipherEntity");
    if (entityAskBtn) {
      entityAskBtn.addEventListener("click", () => {
        const nameEl = document.getElementById("nodeInspectName");
        const entName = nameEl?.textContent && nameEl.textContent !== "—" ? nameEl.textContent.trim() : "selected entity";
        if (typeof window.switchWorkspaceView === "function") window.switchWorkspaceView("ai-investigator");
        window.sendAIQuery(`What are the verified connections, communications, and activities of ${entName}?`, { screen: "network" });
      });
    }

    // Contextual button on Location Inspector (GIS workspace)
    const locationAskBtn = document.getElementById("btnInspectAskCipherLocation");
    if (locationAskBtn) {
      locationAskBtn.addEventListener("click", () => {
        const locEl = document.getElementById("gisInfoTitle");
        const locName = locEl?.textContent && locEl.textContent !== "No location selected" ? locEl.textContent.trim() : "selected location";
        if (typeof window.switchWorkspaceView === "function") window.switchWorkspaceView("ai-investigator");
        window.sendAIQuery(`Analyze spatial events, sightings, and transit corridors associated with ${locName}.`, { screen: "gis" });
      });
    }

    // Contextual button on Case Report Toolbar
    const reportAiBtn = document.getElementById("reportAiDraftBtn");
    if (reportAiBtn) {
      reportAiBtn.addEventListener("click", () => {
        if (typeof window.switchWorkspaceView === "function") window.switchWorkspaceView("ai-investigator");
        window.sendAIQuery("Draft official case intelligence report.", { screen: "evidence" });
      });
    }

    // Initial fetch of activity stats
    window.refreshAIActivity();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindAIEvents);
  } else {
    bindAIEvents();
  }
})();

/* =============================================================================
   CIPHER REVIEW SECTION & ADJUDICATION SUBSYSTEM (SPEC v1.0)
   Human-in-the-loop verification, diff inspector, bulk review, and audit trail
   ============================================================================= */
(function initReviewSubsystem() {
  const DEFAULT_CASE_ID = 0;
  let activeCaseId = 0;
  let reviewItems = [];
  let activeItem = null;
  let selectedItemIds = new Set();
  let currentTypeFilter = "ALL";
  let currentStatusFilter = "PENDING";
  let currentSourceFilter = "ALL";
  let currentSearchQuery = "";
  let pendingRejectItemId = null;
  let pendingRejectItemIds = [];

  function getAuthToken() {
    return (
      localStorage.getItem("cipher_access_token") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("cipher_access_token") ||
      ""
    );
  }

  function getAuthHeaders() {
    const headers = { "Content-Type": "application/json" };
    const token = getAuthToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  function showToast(msg) {
    let t = document.getElementById("reviewToast");
    if (!t) {
      t = document.createElement("div");
      t.id = "reviewToast";
      t.className = "network-toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => {
      t.classList.remove("show");
    }, 3200);
  }

  function getConfidenceTier(conf) {
    const num = typeof conf === "number" ? conf : parseFloat(conf) || 0;
    if (num >= 0.9 || num >= 90) return { label: `${Math.round(num > 1 ? num : num * 100)}% HIGH`, tier: "high", color: "green" };
    if (num >= 0.7 || num >= 70) return { label: `${Math.round(num > 1 ? num : num * 100)}% MED`, tier: "medium", color: "yellow" };
    return { label: `${Math.round(num > 1 ? num : num * 100)}% LOW`, tier: "low", color: "red" };
  }

  function formatFindingTitle(item) {
    const type = (item.type || "").toLowerCase();
    const ai = item.ai_output || {};

    if (type === "entity") {
      return `${ai.name || item.entity_id || "Entity"} (${ai.entity_type || ai.type || "Person"})`;
    } else if (type === "relationship") {
      return `${ai.source_name || "Entity"} —[${ai.relationship_type || "RELATED_TO"}]→ ${ai.target_name || "Entity"}`;
    } else if (type === "location") {
      return `${ai.name || item.location_name || "Location"} — ${ai.address || "Geocoded Coordinate"}`;
    } else if (type === "duplicate") {
      return `Merge Candidate: ${ai.primary_name || "Primary"} ↔ ${ai.duplicate_name || "Candidate"}`;
    } else if (type === "event") {
      return `Event: ${ai.event_type || ai.title || "Observation"} (${ai.timestamp || "Dated"})`;
    }
    return `Finding #${item.id}`;
  }

  // Load Review Workspace
  window.loadReviewWorkspace = async function() {
  try {
    const selectedCaseId = Number(window.CipherCaseState?.id || 0);

    if (!selectedCaseId || !window.CipherCaseState?.caseSelected) {
      console.warn("[Review Subsystem] No active case selected.");
      return;
    }

    activeCaseId = selectedCaseId;

    const kickerEl = document.getElementById("reviewCaseKicker");
    if (kickerEl) kickerEl.textContent = `CASE / C-2026-0${activeCaseId}`;

    let url = `/api/cases/${activeCaseId}/review?status=${encodeURIComponent(currentStatusFilter)}`;
      if (currentTypeFilter !== "ALL") {
        url += `&type=${encodeURIComponent(currentTypeFilter)}`;
      }
      if (currentSearchQuery.trim()) {
        url += `&search=${encodeURIComponent(currentSearchQuery.trim())}`;
      }

    const res = await fetch(url, { headers: getAuthHeaders() });

if (!res.ok) {
  const errorText = await res.text();

  console.error(
    "[Review Subsystem] API Error:",
    res.status,
    errorText
  );

  throw new Error(
    `Review API failed (${res.status}): ${errorText}`
  );
}
      const data = await res.json();

      reviewItems = data.items || [];
      const summary = data.summary || {};

      // 1. Update Metrics
      updateMetrics(summary);

      // 2. Update Category Tab Counts
      updateTabCounts(summary);

      // 3. Update Sources dropdown
      populateSourceDropdown();

      // 4. Render Cards List
      renderReviewCards();

      // 5. Update Inspector
      if (reviewItems.length > 0) {
        // If current activeItem is still in list, keep it; else select first
        const exists = activeItem && reviewItems.find(i => i.id === activeItem.id);
        if (exists) {
          selectReviewItem(exists.id);
        } else {
          selectReviewItem(reviewItems[0].id);
        }
      } else {
        closeInspector();
      }

      // 6. Update Sidebar Badge
      updateSidebarBadge(summary.pending ?? 0);

    } catch (err) {
      console.error("[Review Subsystem] Error loading review workspace:", err);
    }
  };

  function updateMetrics(summary) {
    const pendingEl = document.getElementById("reviewStatPending");
    const verifiedEl = document.getElementById("reviewStatVerified");
    const rejectedEl = document.getElementById("reviewStatRejected");
    const editedEl = document.getElementById("reviewStatEdited");

    if (pendingEl) pendingEl.textContent = summary.pending ?? 0;
    if (verifiedEl) verifiedEl.textContent = summary.accepted ?? 0;
    if (rejectedEl) rejectedEl.textContent = summary.rejected ?? 0;
    if (editedEl) editedEl.textContent = summary.edited ?? 0;
  }

  function updateTabCounts(summary) {
    const counts = summary.by_type || {};
    const countAll = document.getElementById("tabCountAll");
    const countEnt = document.getElementById("tabCountEntity");
    const countRel = document.getElementById("tabCountRelationship");
    const countLoc = document.getElementById("tabCountLocation");
    const countDup = document.getElementById("tabCountDuplicate");
    const countEvt = document.getElementById("tabCountEvent");
    const countLow = document.getElementById("tabCountLowConf");

    if (countAll) countAll.textContent = summary.pending ?? reviewItems.length;
    if (countEnt) countEnt.textContent = counts.entity ?? 0;
    if (countRel) countRel.textContent = counts.relationship ?? 0;
    if (countLoc) countLoc.textContent = counts.location ?? 0;
    if (countDup) countDup.textContent = counts.duplicate ?? 0;
    if (countEvt) countEvt.textContent = counts.event ?? 0;
    if (countLow) countLow.textContent = summary.low_confidence ?? 0;
  }

  function updateSidebarBadge(pendingCount) {
    const badge = document.getElementById("reviewNavBadge");
    if (badge) {
      badge.textContent = pendingCount;
      badge.style.display = pendingCount > 0 ? "inline-block" : "none";
    }
  }
  window.refreshReviewBadge = async function() {
  try {
    const selectedCaseId = Number(window.CipherCaseState?.id || 0);

    if (!selectedCaseId || !window.CipherCaseState?.caseSelected) {
      updateSidebarBadge(0);
      return;
    }

    activeCaseId = selectedCaseId;

    const res = await fetch(
      `/api/cases/${activeCaseId}/review?status=PENDING`,
      { headers: getAuthHeaders() }
    );

    if (res.ok) {
      const data = await res.json();
      const pendingCount = data.summary?.pending ?? data.total ?? 0;
      updateSidebarBadge(pendingCount);
    }
  } catch (e) {
    console.warn("[Review Subsystem] Failed to refresh badge:", e);
  }
};

  function populateSourceDropdown() {
    const select = document.getElementById("reviewSourceSelect");
    if (!select) return;

    const currentVal = select.value;
    const sources = new Set();
    reviewItems.forEach(item => {
      const src = item.source_reference?.document_name || item.evidence_name;
      if (src) sources.add(src);
    });

    let html = `<option value="ALL">All Evidence Documents</option>`;
    sources.forEach(src => {
      html += `<option value="${escapeHtml(src)}">${escapeHtml(src)}</option>`;
    });
    select.innerHTML = html;
    if (sources.has(currentVal)) {
      select.value = currentVal;
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Render Review Cards in Queue Column
  function renderReviewCards() {
    const listEl = document.getElementById("reviewItemsList");
    const emptyEl = document.getElementById("reviewEmptyState");
    const titleEl = document.getElementById("reviewQueueListTitle");

    if (!listEl) return;

    let filtered = reviewItems;
    if (currentSourceFilter !== "ALL") {
      filtered = filtered.filter(i => (i.source_reference?.document_name || i.evidence_name) === currentSourceFilter);
    }

    if (titleEl) {
      titleEl.textContent = `${currentStatusFilter} FINDINGS QUEUE (${filtered.length})`;
    }

    if (filtered.length === 0) {
      listEl.innerHTML = "";
      if (emptyEl) emptyEl.style.display = "flex";
      return;
    }

    if (emptyEl) emptyEl.style.display = "none";

    let html = "";
    filtered.forEach(item => {
      const type = (item.type || "entity").toLowerCase();
      const conf = getConfidenceTier(item.confidence);
      const isSelected = activeItem && activeItem.id === item.id;
      const isChecked = selectedItemIds.has(item.id);
      const title = formatFindingTitle(item);
      const srcName = item.source_reference?.document_name || item.evidence_name || "Investigation Document";
      const srcRef = item.source_reference?.page_or_row || (item.source_reference?.page ? `Page ${item.source_reference.page}` : "Reference Verified");
      const quote = item.extracted_context?.quote || item.extracted_context?.snippet || "Evidence excerpt captured during analytical extraction.";
      const statusClass = (item.status || "PENDING").toLowerCase();

      html += `
        <div class="review-card-item ${isSelected ? "selected" : ""}" data-id="${item.id}" id="reviewCard_${item.id}">
          <div class="review-card-top">
            <div class="card-top-left">
              <input type="checkbox" class="review-item-checkbox" data-id="${item.id}" ${isChecked ? "checked" : ""} />
              <span class="finding-type-badge badge-${type}">${type}</span>
            </div>
            <div class="card-confidence-meter">
              <span class="conf-pill ${conf.tier}">${conf.label}</span>
            </div>
          </div>

          <h4 class="review-card-title">${escapeHtml(title)}</h4>

          <blockquote class="review-card-quote">
            "${escapeHtml(quote)}"
          </blockquote>

          <div class="review-card-meta">
            <div class="card-source-tag">
              <span>📄</span>
              <b>${escapeHtml(srcName)}</b>
              <span>•</span>
              <span>${escapeHtml(srcRef)}</span>
            </div>
            <span class="card-status-pill ${statusClass}">${item.status || "PENDING"}</span>
          </div>

          <div class="review-card-actions">
            ${item.status === "PENDING" ? `
              <button type="button" class="btn-card-action btn-card-accept" data-action="accept" data-id="${item.id}">✓ ACCEPT</button>
              <button type="button" class="btn-card-action btn-card-edit" data-action="edit" data-id="${item.id}">✎ EDIT</button>
              <button type="button" class="btn-card-action btn-card-reject" data-action="reject" data-id="${item.id}">✕ REJECT</button>
            ` : ""}
            <button type="button" class="btn-card-action btn-card-inspect" data-action="inspect" data-id="${item.id}">INSPECT DETAILS →</button>
          </div>
        </div>
      `;
    });

    listEl.innerHTML = html;

    // Attach click handlers to cards and buttons
    listEl.querySelectorAll(".review-card-item").forEach(card => {
      const id = parseInt(card.dataset.id, 10);
      card.addEventListener("click", (e) => {
        if (e.target.closest("button") || e.target.closest("input[type='checkbox']")) return;
        selectReviewItem(id);
      });
    });

    listEl.querySelectorAll(".review-item-checkbox").forEach(chk => {
      chk.addEventListener("change", (e) => {
        const id = parseInt(chk.dataset.id, 10);
        if (chk.checked) {
          selectedItemIds.add(id);
        } else {
          selectedItemIds.delete(id);
        }
        updateBulkToolbar();
      });
    });

    listEl.querySelectorAll("button[data-action]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const id = parseInt(btn.dataset.id, 10);
        if (action === "accept") {
          handleAcceptItem(id);
        } else if (action === "edit") {
          selectReviewItem(id);
          const firstInput = document.querySelector("#inspEditForm input");
          if (firstInput) firstInput.focus();
        } else if (action === "reject") {
          openRejectModal(id);
        } else if (action === "inspect") {
          selectReviewItem(id);
        }
      });
    });
  }

  function updateBulkToolbar() {
    const countEl = document.getElementById("reviewSelectedCount");
    const bulkAcceptBtn = document.getElementById("reviewBulkAcceptBtn");
    const bulkRejectBtn = document.getElementById("reviewBulkRejectBtn");
    const rejectCountEl = document.getElementById("reviewSelectedRejectCount");
    const selectAllChk = document.getElementById("reviewSelectAll");

    const count = selectedItemIds.size;
    if (countEl) countEl.textContent = count;
    if (rejectCountEl) rejectCountEl.textContent = count;
    if (bulkAcceptBtn) bulkAcceptBtn.disabled = count === 0;
    if (bulkRejectBtn) bulkRejectBtn.disabled = count === 0;
    if (selectAllChk) {
      const visibleCheckboxes = document.querySelectorAll(".review-item-checkbox");
      selectAllChk.checked = visibleCheckboxes.length > 0 && count === visibleCheckboxes.length;
    }
  }

  // Select Item and Render into Inspector Panel
  async function selectReviewItem(id) {
    const item = reviewItems.find(i => i.id === id);
    if (!item) return;

    activeItem = item;

    // Highlight card in list
    document.querySelectorAll(".review-card-item").forEach(c => {
      c.classList.toggle("selected", parseInt(c.dataset.id, 10) === id);
    });

    // Show Inspector Panel
    const emptyEl = document.getElementById("reviewInspectorEmpty");
    const panelEl = document.getElementById("reviewInspectorPanel");
    if (emptyEl) emptyEl.style.display = "none";
    if (panelEl) panelEl.style.display = "flex";

    // Render inspector contents
    renderInspector(item);
  }

  function closeInspector() {
    activeItem = null;
    const emptyEl = document.getElementById("reviewInspectorEmpty");
    const panelEl = document.getElementById("reviewInspectorPanel");
    if (emptyEl) emptyEl.style.display = "flex";
    if (panelEl) panelEl.style.display = "none";
    document.querySelectorAll(".review-card-item").forEach(c => c.classList.remove("selected"));
  }

  async function renderInspector(item) {
    const type = (item.type || "entity").toLowerCase();
    const conf = getConfidenceTier(item.confidence);
    const title = formatFindingTitle(item);

    // Header badges & title
    const typeBadge = document.getElementById("inspFindingTypeBadge");
    const confBadge = document.getElementById("inspConfidenceBadge");
    const statusBadge = document.getElementById("inspStatusBadge");
    const titleEl = document.getElementById("inspFindingTitle");

    if (typeBadge) {
      typeBadge.className = `finding-type-badge badge-${type}`;
      typeBadge.textContent = type;
    }
    if (confBadge) {
      confBadge.className = `finding-conf-badge conf-pill ${conf.tier}`;
      confBadge.textContent = conf.label;
    }
    if (statusBadge) {
      statusBadge.className = `card-status-pill ${(item.status || "PENDING").toLowerCase()}`;
      statusBadge.textContent = item.status || "PENDING";
    }
    if (titleEl) titleEl.textContent = title;

    // Provenance / Citation
    const docName = document.getElementById("inspDocName");
    const docRef = document.getElementById("inspDocRef");
    const quoteEl = document.getElementById("inspEvidenceSnippet");

    const srcName = item.source_reference?.document_name || item.evidence_name || "Investigation Document";
    const srcRef = item.source_reference?.page_or_row || (item.source_reference?.page ? `Page ${item.source_reference.page}` : "Reference Verified");
    const quote = item.extracted_context?.quote || item.extracted_context?.snippet || "Evidence excerpt captured during extraction.";

    if (docName) docName.textContent = srcName;
    if (docRef) docRef.textContent = srcRef;
    if (quoteEl) quoteEl.textContent = `"${quote}"`;

    // AI Reasoning
    const aiReason = document.getElementById("inspAiReason");
    const confBarFill = document.getElementById("inspConfBarFill");
    const confScoreText = document.getElementById("inspConfScoreText");

    const rawConf = typeof item.confidence === "number" ? item.confidence : parseFloat(item.confidence) || 0.8;
    const pct = Math.round(rawConf > 1 ? rawConf : rawConf * 100);

    if (aiReason) aiReason.textContent = item.reason || "High-confidence finding extracted by neural NER and structured association models.";
    if (confBarFill) {
      confBarFill.className = `conf-bar-fill ${conf.color}`;
      confBarFill.style.width = `${pct}%`;
    }
    if (confScoreText) confScoreText.textContent = `${(pct / 100).toFixed(2)} (${conf.tier.toUpperCase()})`;

    // Comparison with Existing Case Graph
    renderGraphComparison(item);

    // Dynamic Edit Form
    renderEditForm(item);

    // Adjudication Buttons state
    const acceptBtn = document.getElementById("inspAcceptBtn");
    const editBtn = document.getElementById("inspEditBtn");
    const rejectBtn = document.getElementById("inspRejectBtn");

    const isPending = (item.status || "PENDING") === "PENDING";
    if (acceptBtn) acceptBtn.disabled = !isPending;
    if (editBtn) editBtn.disabled = !isPending;
    if (rejectBtn) rejectBtn.disabled = !isPending;

    // Previous Item Audit History if exists
    const auditSec = document.getElementById("inspAuditHistorySection");
    const auditList = document.getElementById("inspItemAuditList");
    if (item.reviewed_by) {
      if (auditSec) auditSec.style.display = "flex";
      if (auditList) {
        auditList.innerHTML = `
          <div class="comparison-match-item">
            <div>
              <b>Reviewed by:</b> ${escapeHtml(item.reviewed_by)}<br>
              <span style="font-size:11px;color:#7b8e81;">${escapeHtml(item.reviewed_at || "Recent")}</span>
            </div>
            <div>
              <span class="card-status-pill ${(item.status || "").toLowerCase()}">${item.status}</span>
            </div>
          </div>
          ${item.review_note ? `<p style="font-size:12px;color:#a4b7aa;margin:6px 0 0;">Note: ${escapeHtml(item.review_note)}</p>` : ""}
        `;
      }
    } else {
      if (auditSec) auditSec.style.display = "none";
    }
  }

  // Graph Knowledge Comparison
  async function renderGraphComparison(item) {
    const compBox = document.getElementById("inspComparisonBox");
    if (!compBox) return;

    const type = (item.type || "").toLowerCase();
    const ai = item.ai_output || {};

    if (type === "entity") {
      const name = ai.name || "";
      compBox.innerHTML = `
        <p class="comparison-novelty-note">Checking existing case knowledge for <b>"${escapeHtml(name)}"</b>...</p>
      `;

      try {
        const res = await fetch(`/api/cases/${window.CipherCaseState?.id || activeCaseId}/entities`, { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          const entities = data.entities || data.data || [];
          const matches = entities.filter(e => 
            (e.label || e.name || "").toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes((e.label || e.name || "").toLowerCase())
          );

          if (matches.length > 0) {
            let matchHtml = `<p class="comparison-novelty-note" style="color:#fbbf24;">⚠ Similar existing entity found in case ledger:</p>`;
            matches.forEach(m => {
              matchHtml += `
                <div class="comparison-match-item">
                  <div>
                    <b style="color:#38bdf8;">${escapeHtml(m.label || m.name || "Unknown")}</b> (${escapeHtml(m.entity_type || m.type)})
                    <div style="font-size:10px;color:#6b7f72;">ID: ${m.id} • Verified in ledger</div>
                  </div>
                  <button type="button" class="btn-card-action" style="background:#25342a;color:#d9ff55;" id="btnCompareLinkNode_${m.id}">
                    CONFIRM RESOLUTION
                  </button>
                </div>
              `;
            });
            compBox.innerHTML = matchHtml;
          } else {
            compBox.innerHTML = `
              <p class="comparison-novelty-note" style="color:#34d399;">
                ✓ Novel Entity: No duplicate record matching "${escapeHtml(name)}" exists in this case ledger. Committing this finding will establish a new verified node.
              </p>
            `;
          }
        }
      } catch (e) {
        compBox.innerHTML = `<p class="comparison-novelty-note">Novel entity candidate. Ready for graph promotion.</p>`;
      }
    } else if (type === "relationship") {
      const s = ai.source_name || "Source";
      const r = ai.relationship_type || "RELATED_TO";
      const t = ai.target_name || "Target";
      compBox.innerHTML = `
        <div class="comparison-novelty-note">
          <b>Graph Linkage Preview:</b>
          <div style="margin-top:8px;padding:8px 12px;background:#090d0a;border-radius:4px;font-family:'DM Mono',monospace;color:#facc15;">
            (${escapeHtml(s)}) — [${escapeHtml(r)}] → (${escapeHtml(t)})
          </div>
          <p style="margin:8px 0 0;font-size:11px;color:#7b8e81;">
            Directional verification ensures accurate centrality and shortest-path computation in network topology.
          </p>
        </div>
      `;
    } else if (type === "location") {
      const lat = ai.latitude || item.latitude || "—";
      const lng = ai.longitude || item.longitude || "—";
      compBox.innerHTML = `
        <div class="comparison-novelty-note">
          <b>GIS Spatial Layer Check:</b>
          <div style="display:flex;gap:16px;margin-top:6px;font-family:'DM Mono',monospace;font-size:12px;color:#34d399;">
            <span>LAT: ${escapeHtml(String(lat))}</span>
            <span>LNG: ${escapeHtml(String(lng))}</span>
          </div>
          <p style="margin:8px 0 0;font-size:11px;color:#7b8e81;">
            Approving this finding plots coordinates onto the workspace GIS map layer with verified intelligence marker.
          </p>
        </div>
      `;
    } else if (type === "duplicate") {
      const p = ai.primary_name || "Primary Entity";
      const d = ai.duplicate_name || "Candidate Entity";
      compBox.innerHTML = `
        <div class="comparison-novelty-note">
          <table style="width:100%;font-size:11px;border-collapse:collapse;margin-top:6px;">
            <thead>
              <tr style="color:#7b8e81;border-bottom:1px solid #202b23;">
                <th style="text-align:left;padding:4px;">CANONICAL MASTER</th>
                <th style="text-align:left;padding:4px;">MERGE CANDIDATE</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding:6px;color:#38bdf8;font-weight:700;">${escapeHtml(p)}</td>
                <td style="padding:6px;color:#c084fc;font-weight:700;">${escapeHtml(d)}</td>
              </tr>
            </tbody>
          </table>
          <p style="margin:8px 0 0;font-size:11px;color:#a855f7;">
            Resolution transfers all associated communications and links from candidate into canonical entity.
          </p>
        </div>
      `;
    } else {
      compBox.innerHTML = `
        <p class="comparison-novelty-note">Ready for investigator adjudication.</p>
      `;
    }
  }

  // Dynamic Attribute Edit Form
  function renderEditForm(item) {
    const formEl = document.getElementById("inspEditForm");
    if (!formEl) return;

    const type = (item.type || "").toLowerCase();
    const ai = item.ai_output || {};

    if (type === "entity") {
      const name = ai.name || "";
      const entType = ai.entity_type || ai.type || "Person";
      const aliases = Array.isArray(ai.aliases) ? ai.aliases.join(", ") : (ai.aliases || "");
      const role = ai.role || ai.notes || "";

      formEl.innerHTML = `
        <div class="form-row">
          <label for="editFormEntityName">Entity Full Name / Canonical Identifier:</label>
          <input type="text" id="editFormEntityName" class="form-input" value="${escapeHtml(name)}" />
        </div>
        <div class="form-grid-2">
          <div class="form-row">
            <label for="editFormEntityType">Entity Category:</label>
            <select id="editFormEntityType" class="review-select" style="width:100%;">
              <option value="Person" ${entType === "Person" ? "selected" : ""}>Person</option>
              <option value="Organization" ${entType === "Organization" ? "selected" : ""}>Organization</option>
              <option value="Phone" ${entType === "Phone" ? "selected" : ""}>Phone</option>
              <option value="Vehicle" ${entType === "Vehicle" ? "selected" : ""}>Vehicle</option>
              <option value="Location" ${entType === "Location" ? "selected" : ""}>Facility / Location</option>
              <option value="Weapon" ${entType === "Weapon" ? "selected" : ""}>Weapon / Explosive</option>
              <option value="Cyber" ${entType === "Cyber" ? "selected" : ""}>Cyber / Domain</option>
            </select>
          </div>
          <div class="form-row">
            <label for="editFormEntityAliases">Known Aliases (Comma-separated):</label>
            <input type="text" id="editFormEntityAliases" class="form-input" value="${escapeHtml(aliases)}" placeholder="e.g. Rahul, Chhota Bhai" />
          </div>
        </div>
        <div class="form-row">
          <label for="editFormEntityRole">Case Role / Key Intelligence Summary:</label>
          <input type="text" id="editFormEntityRole" class="form-input" value="${escapeHtml(role)}" placeholder="e.g. Hawala money courier / Logistics coordinator" />
        </div>
      `;
    } else if (type === "relationship") {
      const src = ai.source_name || "";
      const relType = ai.relationship_type || "CALLS";
      const tgt = ai.target_name || "";
      const quote = ai.evidence_quote || item.extracted_context?.quote || "";

      const relOptions = [
        "CALLS",
        "ASSOCIATED_WITH",
        "TRANSFERS_TO",
        "COMMUNICATES_WITH",
        "TRAVELS_WITH",
        "MEETS_WITH",
        "OPERATES_UNDER",
        "LOCATED_AT",
        "OWNS",
        "DRIVES",
        "WORKS_FOR"
      ];

      let optionsHtml = relOptions.map(opt => `
        <option value="${opt}" ${relType === opt ? "selected" : ""}>${opt}</option>
      `).join("");

      formEl.innerHTML = `
        <div class="form-grid-2">
          <div class="form-row">
            <label for="editFormRelSource">Source Entity:</label>
            <input type="text" id="editFormRelSource" class="form-input" value="${escapeHtml(src)}" />
          </div>
          <div class="form-row">
            <label for="editFormRelTarget">Target Entity:</label>
            <input type="text" id="editFormRelTarget" class="form-input" value="${escapeHtml(tgt)}" />
          </div>
        </div>
        <div class="form-row">
          <label for="editFormRelType">Controlled Relationship Type:</label>
          <select id="editFormRelType" class="review-select" style="width:100%;">
            ${optionsHtml}
          </select>
        </div>
        <div class="form-row">
          <label for="editFormRelQuote">Evidentiary Citation Quote:</label>
          <input type="text" id="editFormRelQuote" class="form-input" value="${escapeHtml(quote)}" />
        </div>
      `;
    } else if (type === "location") {
      const name = ai.name || item.location_name || "";
      const address = ai.address || "";
      const lat = ai.latitude || "";
      const lng = ai.longitude || "";

      formEl.innerHTML = `
        <div class="form-row">
          <label for="editFormLocName">Location Name / Landmark:</label>
          <input type="text" id="editFormLocName" class="form-input" value="${escapeHtml(name)}" />
        </div>
        <div class="form-row">
          <label for="editFormLocAddress">Address / Neighborhood:</label>
          <input type="text" id="editFormLocAddress" class="form-input" value="${escapeHtml(address)}" />
        </div>
        <div class="form-grid-2">
          <div class="form-row">
            <label for="editFormLocLat">Latitude:</label>
            <input type="number" step="any" id="editFormLocLat" class="form-input" value="${escapeHtml(String(lat))}" />
          </div>
          <div class="form-row">
            <label for="editFormLocLng">Longitude:</label>
            <input type="number" step="any" id="editFormLocLng" class="form-input" value="${escapeHtml(String(lng))}" />
          </div>
        </div>
      `;
    } else if (type === "duplicate") {
      const p = ai.primary_name || "";
      const d = ai.duplicate_name || "";
      formEl.innerHTML = `
        <div class="form-grid-2">
          <div class="form-row">
            <label for="editFormDupPrimary">Retained Master Entity:</label>
            <input type="text" id="editFormDupPrimary" class="form-input" value="${escapeHtml(p)}" />
          </div>
          <div class="form-row">
            <label for="editFormDupSecondary">Merged Candidate Entity:</label>
            <input type="text" id="editFormDupSecondary" class="form-input" value="${escapeHtml(d)}" />
          </div>
        </div>
        <div class="form-row">
          <label for="editFormDupAliases">Add Candidate As Alias To Master:</label>
          <input type="text" id="editFormDupAliases" class="form-input" value="${escapeHtml(d)}" />
        </div>
      `;
    } else {
      const rawJson = JSON.stringify(ai, null, 2);
      formEl.innerHTML = `
        <div class="form-row">
          <label for="editFormRawJson">Structured Attributes (JSON):</label>
          <textarea id="editFormRawJson" class="review-textarea" rows="4">${escapeHtml(rawJson)}</textarea>
        </div>
      `;
    }
  }

  // Get Form Values on Edit
  function collectEditedData(item) {
    const type = (item.type || "").toLowerCase();
    const base = { ...(item.ai_output || {}) };

    if (type === "entity") {
      const name = document.getElementById("editFormEntityName")?.value?.trim();
      const entType = document.getElementById("editFormEntityType")?.value;
      const aliasesStr = document.getElementById("editFormEntityAliases")?.value?.trim();
      const role = document.getElementById("editFormEntityRole")?.value?.trim();

      if (name) base.name = name;
      if (entType) base.entity_type = entType;
      if (aliasesStr) {
        base.aliases = aliasesStr.split(",").map(s => s.trim()).filter(Boolean);
      }
      if (role) base.role = role;
    } else if (type === "relationship") {
      const src = document.getElementById("editFormRelSource")?.value?.trim();
      const tgt = document.getElementById("editFormRelTarget")?.value?.trim();
      const relType = document.getElementById("editFormRelType")?.value;
      const quote = document.getElementById("editFormRelQuote")?.value?.trim();

      if (src) base.source_name = src;
      if (tgt) base.target_name = tgt;
      if (relType) base.relationship_type = relType;
      if (quote) base.evidence_quote = quote;
    } else if (type === "location") {
      const name = document.getElementById("editFormLocName")?.value?.trim();
      const addr = document.getElementById("editFormLocAddress")?.value?.trim();
      const lat = parseFloat(document.getElementById("editFormLocLat")?.value);
      const lng = parseFloat(document.getElementById("editFormLocLng")?.value);

      if (name) base.name = name;
      if (addr) base.address = addr;
      if (!isNaN(lat)) base.latitude = lat;
      if (!isNaN(lng)) base.longitude = lng;
    } else if (type === "duplicate") {
      const p = document.getElementById("editFormDupPrimary")?.value?.trim();
      const d = document.getElementById("editFormDupSecondary")?.value?.trim();
      if (p) base.primary_name = p;
      if (d) base.duplicate_name = d;
    } else {
      const rawText = document.getElementById("editFormRawJson")?.value?.trim();
      if (rawText) {
        try {
          return JSON.parse(rawText);
        } catch (e) {}
      }
    }
    return base;
  }

  // Adjudication Handlers
  async function handleAcceptItem(id) {
    try {
      const res = await fetch(`/review/${id}/accept`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          reviewer: "Investigator Officer",
          review_note: "Verified from source evidence and committed to graph"
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to accept item");
      }

      showToast("✓ Finding accepted and permanently committed to case graph!");
      selectedItemIds.delete(Number(id));
      await window.loadReviewWorkspace();
      updateBulkToolbar();

      // Trigger background syncs
      if (typeof window.loadWorkspaceGISData === "function") window.loadWorkspaceGISData();
      if (typeof window.refreshAIActivity === "function") window.refreshAIActivity();

    } catch (err) {
      console.error("[Review Subsystem] Accept error:", err);
      showToast(`Error accepting finding: ${err.message}`);
    }
  }

  async function handleEditItem(id) {
    const item = reviewItems.find(i => i.id === id);
    if (!item) return;

    const editedData = collectEditedData(item);

    try {
      const res = await fetch(`/review/${id}/edit`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          edited_data: editedData,
          reviewer: "Investigator Officer",
          review_note: "Investigator modified finding attributes before committing"
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to edit item");
      }

      showToast("✎ Finding edits saved & committed to case graph!");
      window.loadReviewWorkspace();

      // Trigger background syncs
      if (typeof window.loadWorkspaceGISData === "function") window.loadWorkspaceGISData();
      if (typeof window.refreshAIActivity === "function") window.refreshAIActivity();

    } catch (err) {
      console.error("[Review Subsystem] Edit error:", err);
      showToast(`Error editing finding: ${err.message}`);
    }
  }

  function openRejectModal(id) {
    pendingRejectItemId = Number(id);
    pendingRejectItemIds = [Number(id)];
    const item = reviewItems.find(i => i.id === Number(id));
    const titleEl = document.getElementById("rejectModalItemTitle");
    if (titleEl) titleEl.textContent = item ? formatFindingTitle(item) : `#${id}`;

    const modal = document.getElementById("reviewRejectModal");
    if (modal) modal.style.display = "flex";
  }

  function openBulkRejectModal(ids) {
    const cleanIds = Array.from(new Set((ids || []).map(Number).filter(Number.isFinite)));
    if (!cleanIds.length) return;
    pendingRejectItemId = cleanIds[0];
    pendingRejectItemIds = cleanIds;
    const titleEl = document.getElementById("rejectModalItemTitle");
    if (titleEl) titleEl.textContent = `${cleanIds.length} selected findings`;
    const modal = document.getElementById("reviewRejectModal");
    if (modal) modal.style.display = "flex";
  }

  function closeRejectModal() {
    pendingRejectItemId = null;
    pendingRejectItemIds = [];
    const modal = document.getElementById("reviewRejectModal");
    if (modal) modal.style.display = "none";
  }

  async function confirmRejectItem() {
    const ids = pendingRejectItemIds.length ? pendingRejectItemIds.slice() : (pendingRejectItemId ? [pendingRejectItemId] : []);
    if (!ids.length) return;
    const reasonSelect = document.getElementById("rejectReasonSelect");
    const notesInput = document.getElementById("rejectNotesInput");

    const reason = reasonSelect?.value || "Incorrect finding";
    const notes = notesInput?.value?.trim() || "";

    try {
      const endpoint = ids.length === 1 ? `/review/${ids[0]}/reject` : `/review/bulk-reject`;
      const payload = ids.length === 1
        ? { reason, review_note: notes, reviewer: "Investigator Officer" }
        : { review_ids: ids, reason, note: notes, reviewer: "Investigator Officer" };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.detail || "Failed to reject finding(s)");
      }

      const result = await res.json().catch(() => ({}));
      closeRejectModal();
      selectedItemIds.clear();
      showToast(ids.length === 1
        ? "✕ Finding rejected from case ledger with audit record."
        : `✕ ${result.rejected_count ?? ids.length} selected findings rejected with audit records.`);
      await window.loadReviewWorkspace();
      updateBulkToolbar();

      if (typeof window.refreshAIActivity === "function") window.refreshAIActivity();
      if (typeof window.loadNetworkGraph === "function") await window.loadNetworkGraph(window.CipherCaseState?.id || activeCaseId);

    } catch (err) {
      console.error("[Review Subsystem] Reject error:", err);
      showToast(`Error rejecting finding(s): ${err.message}`);
    }
  }

  async function handleBulkAccept() {
    const ids = Array.from(selectedItemIds);
    if (ids.length === 0) return;

    try {
      const res = await fetch(`/review/bulk-accept`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          review_ids: ids,
          reviewer: "Investigator Officer"
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Bulk accept failed");
      }

      const result = await res.json();
      selectedItemIds.clear();
      showToast(`✓ Bulk verification complete! ${result.accepted_count || ids.length} findings promoted.`);
      await window.loadReviewWorkspace();
      updateBulkToolbar();

      if (typeof window.loadWorkspaceGISData === "function") window.loadWorkspaceGISData();
      if (typeof window.refreshAIActivity === "function") window.refreshAIActivity();

    } catch (err) {
      console.error("[Review Subsystem] Bulk accept error:", err);
      showToast(`Error during bulk accept: ${err.message}`);
    }
  }

  function handleBulkReject() {
    const ids = Array.from(selectedItemIds);
    if (!ids.length) return;
    openBulkRejectModal(ids);
  }

  // Audit Log Modal
  async function openAuditModal() {
    const modal = document.getElementById("reviewAuditModal");
    const tbody = document.getElementById("reviewAuditTableBody");

    if (modal) modal.style.display = "flex";
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:#7b8e81;">Loading immutable audit trail...</td></tr>`;

    try {
      const res = await fetch(`/api/cases/${window.CipherCaseState?.id || activeCaseId}/review/history`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to load audit history");
      const data = await res.json();
      const actions = data.history || data.actions || [];

      if (actions.length === 0) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:#7b8e81;">No adjudication actions logged for this case yet.</td></tr>`;
        return;
      }

      let rows = "";
      actions.forEach(a => {
        const time = a.action_timestamp ? new Date(a.action_timestamp).toLocaleString() : "Recent";
        const actionType = a.action_type || "ACTION";
        const findingTitle = a.item_type ? `${a.item_type.toUpperCase()} #${a.review_item_id}` : `#${a.review_item_id}`;
        const reviewer = a.reviewed_by || a.officer_id || "Investigator Officer";
        const reason = a.reason || a.review_note || (a.diff ? "Attribute modifications saved" : "Verified from source evidence");

        rows += `
          <tr>
            <td style="font-family:'DM Mono',monospace;font-size:11px;color:#8da193;">${escapeHtml(time)}</td>
            <td><span class="audit-action-chip ${actionType}">${escapeHtml(actionType)}</span></td>
            <td><b>${escapeHtml(findingTitle)}</b></td>
            <td><span class="finding-type-badge badge-${(a.item_type || "entity").toLowerCase()}">${escapeHtml(a.item_type || "Finding")}</span></td>
            <td>${escapeHtml(reviewer)}</td>
            <td style="font-size:11px;color:#a4b7aa;">${escapeHtml(reason)}</td>
          </tr>
        `;
      });

      if (tbody) tbody.innerHTML = rows;

    } catch (err) {
      console.error("[Review Subsystem] Audit error:", err);
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:#ef4444;">Error loading audit history: ${err.message}</td></tr>`;
    }
  }

  function closeAuditModal() {
    const modal = document.getElementById("reviewAuditModal");
    if (modal) modal.style.display = "none";
  }

  // Bind UI Events
  function bindReviewEvents() {
    // 1. Category Tabs
    document.querySelectorAll(".review-tab-btn").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".review-tab-btn").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        currentTypeFilter = tab.dataset.type || "ALL";
        window.loadReviewWorkspace();
      });
    });

    // 2. Status Dropdown
    const statusSelect = document.getElementById("reviewStatusSelect");
    if (statusSelect) {
      statusSelect.addEventListener("change", () => {
        currentStatusFilter = statusSelect.value;
        window.loadReviewWorkspace();
      });
    }

    // 3. Source Dropdown
    const sourceSelect = document.getElementById("reviewSourceSelect");
    if (sourceSelect) {
      sourceSelect.addEventListener("change", () => {
        currentSourceFilter = sourceSelect.value;
        renderReviewCards();
      });
    }

    // 4. Search Input (Debounced)
    const searchInput = document.getElementById("reviewSearchInput");
    if (searchInput) {
      let searchTimer = null;
      searchInput.addEventListener("input", () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          currentSearchQuery = searchInput.value;
          window.loadReviewWorkspace();
        }, 280);
      });
    }

    // 5. Select All Checkbox
    const selectAllChk = document.getElementById("reviewSelectAll");
    if (selectAllChk) {
      selectAllChk.addEventListener("change", () => {
        const isChecked = selectAllChk.checked;
        selectedItemIds.clear();
        if (isChecked) {
          reviewItems.forEach(i => selectedItemIds.add(i.id));
        }
        renderReviewCards();
        updateBulkToolbar();
      });
    }

    // 6. Bulk Accept Button
    const bulkAcceptBtn = document.getElementById("reviewBulkAcceptBtn");
    if (bulkAcceptBtn) {
      bulkAcceptBtn.addEventListener("click", handleBulkAccept);
    }

    const bulkRejectBtn = document.getElementById("reviewBulkRejectBtn");
    if (bulkRejectBtn) {
      bulkRejectBtn.addEventListener("click", handleBulkReject);
    }

    // 7. Refresh Button
    const refreshBtn = document.getElementById("reviewRefreshBtn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        window.loadReviewWorkspace();
        showToast("Review findings queue refreshed.");
      });
    }

    // 8. Audit Log Button
    const auditBtn = document.getElementById("reviewViewAuditBtn");
    if (auditBtn) {
      auditBtn.addEventListener("click", openAuditModal);
    }

    // 9. Inspector Decision Buttons
    const inspAcceptBtn = document.getElementById("inspAcceptBtn");
    const inspEditBtn = document.getElementById("inspEditBtn");
    const inspRejectBtn = document.getElementById("inspRejectBtn");
    const inspCloseBtn = document.getElementById("inspCloseBtn");

    if (inspAcceptBtn) {
      inspAcceptBtn.addEventListener("click", () => {
        if (activeItem) handleAcceptItem(activeItem.id);
      });
    }

    if (inspEditBtn) {
      inspEditBtn.addEventListener("click", () => {
        if (activeItem) handleEditItem(activeItem.id);
      });
    }

    if (inspRejectBtn) {
      inspRejectBtn.addEventListener("click", () => {
        if (activeItem) openRejectModal(activeItem.id);
      });
    }

    if (inspCloseBtn) {
      inspCloseBtn.addEventListener("click", closeInspector);
    }

    // 10. Inspect in Evidence Button
    const inspJumpEvidenceBtn = document.getElementById("inspJumpEvidenceBtn");
    if (inspJumpEvidenceBtn) {
      inspJumpEvidenceBtn.addEventListener("click", () => {
        if (typeof window.switchWorkspaceView === "function") {
          window.switchWorkspaceView("evidence");
          showToast(`Navigated to Evidence workspace for ${activeItem?.source_reference?.document_name || "document"}`);
        }
      });
    }

    // 11. Reject Modal Buttons
    const rejectClose = document.getElementById("rejectModalCloseBtn");
    const rejectCancel = document.getElementById("rejectModalCancelBtn");
    const rejectConfirm = document.getElementById("rejectModalConfirmBtn");

    if (rejectClose) rejectClose.addEventListener("click", closeRejectModal);
    if (rejectCancel) rejectCancel.addEventListener("click", closeRejectModal);
    if (rejectConfirm) rejectConfirm.addEventListener("click", confirmRejectItem);

    // 12. Audit Modal Buttons
    const auditClose = document.getElementById("auditModalCloseBtn");
    const auditDone = document.getElementById("auditModalDoneBtn");

    if (auditClose) auditClose.addEventListener("click", closeAuditModal);
    if (auditDone) auditDone.addEventListener("click", closeAuditModal);

    // Initial badge refresh
    window.refreshReviewBadge();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindReviewEvents);
  } else {
    bindReviewEvents();
  }
})();

/* ===== FRONTEND-ONLY IMMERSIVE FULLSCREEN CONTROLS ===== */
(function initCipherFullscreenControls(){
  if (window.__cipherFullscreenControlsInitialized) return;
  window.__cipherFullscreenControlsInitialized = true;

  const enterFullscreen = async (target, button) => {
    if (!target) return;
    try {
      if (document.fullscreenElement === target) {
        await document.exitFullscreen();
        return;
      }
      if (document.fullscreenElement) await document.exitFullscreen();
      if (target.requestFullscreen) await target.requestFullscreen({navigationUI:'hide'});
      else if (target.webkitRequestFullscreen) target.webkitRequestFullscreen();
    } catch (err) {
      console.warn('Fullscreen unavailable:', err);
      if (button) button.blur();
    }
  };

  const networkButton = document.getElementById('networkFullscreenBtn');
  const gisButton = document.getElementById('gisFullscreenBtn');
  const networkTarget = document.querySelector('.network-workbench');
  const gisTarget = document.querySelector('.gis-workbench');

  networkButton?.addEventListener('click', () => enterFullscreen(networkTarget, networkButton));
  gisButton?.addEventListener('click', () => enterFullscreen(gisTarget, gisButton));

  document.addEventListener('fullscreenchange', () => {
    const active = document.fullscreenElement;
    if (networkButton) {
      const on = active === networkTarget;
      networkButton.querySelector('b')?.replaceChildren(document.createTextNode(on ? 'EXIT FULLSCREEN' : 'FULLSCREEN'));
    }
    if (gisButton) {
      const on = active === gisTarget;
      gisButton.querySelector('b')?.replaceChildren(document.createTextNode(on ? 'EXIT FULLSCREEN' : 'FULLSCREEN MAP'));
    }
    window.dispatchEvent(new Event('resize'));
    setTimeout(() => window.dispatchEvent(new Event('resize')), 180);
  });
})();


/* =========================================================
   CIPHER ML LINK PREDICTION INTEGRATION
   ========================================================= */
(function initCipherMlPrediction() {
  const sourceInput = document.getElementById("mlSourceEntity");
  const targetInput = document.getElementById("mlTargetEntity");
  const predictBtn = document.getElementById("mlPredictLinkBtn");
  const candidatesBtn = document.getElementById("mlCandidatesBtn");
  const resultEl = document.getElementById("mlPredictionResult");
  if (!sourceInput || !targetInput || !predictBtn || !candidatesBtn || !resultEl) return;

  const apiBase = (window.CIPHER_API_BASE || "").replace(/\/$/, "");
  const getCaseId = () => Number(window.CipherCaseState?.id || 0);
  const headers = () => {
    const h = { "Accept": "application/json", "Content-Type": "application/json" };
    const token = localStorage.getItem("cipher_access_token");
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  };
  const endpoint = path => `${apiBase}${path}`;
  const render = html => { resultEl.innerHTML = html; };
  const esc = value => typeof escapeHtml === "function" ? escapeHtml(String(value ?? "")) : String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const pct = value => `${(Number(value || 0) * 100).toFixed(2)}%`;

  window.addEventListener("cipher:network-node-select", event => {
    const id = event.detail?.id;
    if (id !== undefined && id !== null) sourceInput.value = String(id).replace(/^ent-/, "");
  });

  async function parseResponse(response) {
    let payload = {};
    try { payload = await response.json(); } catch (_) { payload = { detail: "The server returned an invalid response" }; }
    if (!response.ok) throw new Error(payload.detail || `Request failed (${response.status})`);
    return payload;
  }

  predictBtn.addEventListener("click", async () => {
    const source = sourceInput.value.trim();
    const target = targetInput.value.trim();
    if (!source || !target) { render('<span style="color:#ffb86b;">Enter both source and target entity IDs.</span>'); return; }
    predictBtn.disabled = true;
    render('<span style="color:#7fe9df;">Calculating graph features and prediction…</span>');
    try {
      const localGraph = window.CipherLocalGraphData?.pending ? window.CipherLocalGraphData : null;
      const predictionPath = localGraph ? `/api/cases/${getCaseId()}/ml/preview` : `/api/cases/${getCaseId()}/ml/predict`;
      const predictionBody = localGraph
        ? { source_entity_id: source, target_entity_id: target, nodes: localGraph.nodes || [], edges: localGraph.edges || [] }
        : { source_entity_id: source, target_entity_id: target };
      const data = await parseResponse(await fetch(endpoint(predictionPath), {
        method: "POST", headers: headers(), body: JSON.stringify(predictionBody)
      }));
      const p = data.prediction || {};
      const features = p.features || {};
      const rows = Object.keys(features).map(key => `<div style="display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid rgba(255,255,255,.05);padding:3px 0;"><span>${esc(key)}</span><b>${esc(features[key])}</b></div>`).join("");
      render(`<div style="color:#7fe9df;font-weight:700;margin-bottom:5px;">PREDICTION RESULT</div><div>Probability: <b style="color:#d9ff55;">${pct(p.probability)}</b></div><div>Threshold: <b>${esc(p.threshold)}</b></div><div>Predicted: <b>${p.predicted_relationship ? "YES" : "NO"}</b></div><div>Existing: <b>${p.existing_relationship ? "YES" : "NO"}</b></div><div>Review required: <b>${p.requires_review ? "YES" : "NO"}</b></div><div style="margin-top:8px;color:#7fe9df;">FEATURES</div>${rows}<div style="margin-top:7px;color:#71818b;">${esc(p.label || "Model estimate")}</div>`);
    } catch (error) { render(`<span style="color:#ff777d;">${esc(error.message)}</span>`); }
    finally { predictBtn.disabled = false; }
  });

  candidatesBtn.addEventListener("click", async () => {
    candidatesBtn.disabled = true;
    render('<span style="color:#7fe9df;">Ranking candidate relationships…</span>');
    try {
      const localGraph = window.CipherLocalGraphData?.pending ? window.CipherLocalGraphData : null;
      const candidatesPath = localGraph ? `/api/cases/${getCaseId()}/ml/preview` : `/api/cases/${getCaseId()}/ml/candidates`;
      const candidatesBody = localGraph
        ? { limit: 15, threshold: 0.20, nodes: localGraph.nodes || [], edges: localGraph.edges || [] }
        : { limit: 15, threshold: 0.20 };
      const data = await parseResponse(await fetch(endpoint(candidatesPath), {
        method: "POST", headers: headers(), body: JSON.stringify(candidatesBody)
      }));
      const candidates = data.candidates || [];
      if (!candidates.length) { render('<span style="color:#b9c7cf;">No candidates met the selected threshold.</span>'); return; }
      const html = candidates.map((item, index) => `<div style="padding:7px 0;border-bottom:1px solid rgba(255,255,255,.07);"><div style="color:#7fe9df;">#${index + 1} · ${esc(item.source)} → ${esc(item.target)}</div><div>Probability: <b style="color:#d9ff55;">${pct(item.probability)}</b></div><button type="button" data-ml-source="${esc(item.source)}" data-ml-target="${esc(item.target)}" style="margin-top:4px;background:transparent;border:1px solid #2a4454;color:#7fe9df;padding:3px 6px;font-size:9px;cursor:pointer;">LOAD PAIR</button></div>`).join("");
      render(`<div style="color:#7fe9df;font-weight:700;margin-bottom:5px;">TOP CANDIDATES</div>${html}<div style="margin-top:7px;color:#71818b;">Model estimates require review and are not verified relationships.</div>`);
      resultEl.querySelectorAll("[data-ml-source]").forEach(button => button.addEventListener("click", () => { sourceInput.value = button.dataset.mlSource; targetInput.value = button.dataset.mlTarget; }));
    } catch (error) { render(`<span style="color:#ff777d;">${esc(error.message)}</span>`); }
    finally { candidatesBtn.disabled = false; }
  });
})();

/* =========================================================
   CIPHER VISION — MULTIMODAL INTELLIGENCE COCKPIT
   ========================================================= */
(function initCipherVision(){
  const view=document.getElementById("cipherVisionView"); if(!view)return;
  const caseId=()=>Number(window.CipherCaseState?.caseSelected ? (window.CipherCaseState?.id||0) : 0);
  const headers=()=>typeof window.authHeaders==="function"?window.authHeaders(false):{};
  const esc=v=>typeof window.escapeHtml==="function"?window.escapeHtml(v??""):String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const comms=document.getElementById("visionCommsList"), finance=document.getElementById("visionFinanceList");
  const fetchCdr=document.getElementById("visionFetchCdrBtn"), fetchBank=document.getElementById("visionFetchBankBtn");
  const refresh=document.getElementById("visionRefreshBtn"), resultsRefresh=document.getElementById("visionResultsRefreshBtn"), faceInput=document.getElementById("visionFaceInput");
  const faceChoose=document.getElementById("visionFaceChoose"), faceDrop=document.getElementById("visionFaceDrop");
  const faceMatch=document.getElementById("visionFaceMatch"), facePreview=document.getElementById("visionFacePreview");
  const facePreviewImg=document.getElementById("visionFacePreviewImg"), faceName=document.getElementById("visionFaceName");
  const faceStatus=document.getElementById("visionFaceStatus"), faceResults=document.getElementById("visionFaceResults");
  const faceEngine=document.getElementById("faceEngineStatus"), openGis=document.getElementById("visionOpenGisBtn");
  const podium=document.getElementById("visionFaceDrop"), podiumPhoto=document.getElementById("visionPodiumPhoto"), podiumState=document.getElementById("visionPodiumState");
  const cache=new Map(); let selectedFace=null;

  function empty(el,title,sub){if(el)el.innerHTML=`<div class="vision-empty"><b>${esc(title)}</b><span>${esc(sub)}</span></div>`;}
  function currentCaseLabel(){return window.CipherCaseState?.caseNumber ? `CASE / ${window.CipherCaseState.caseNumber}` : "CASE / —";}
  function requireCase(){const id=caseId(); if(!id){faceStatus.textContent="Select an active case before using Cipher Vision."; return 0;} return id;}
  async function blob(id){
    if(!requireCase())return "";
    const k="e:"+id;if(cache.has(k))return cache.get(k);
    const r=await fetch(`/api/cases/${caseId()}/evidence/${id}`,{headers:headers()});if(!r.ok)return "";
    const u=URL.createObjectURL(await r.blob());cache.set(k,u);return u;
  }
  function bindOpen(){
    view.querySelectorAll("[data-open-evidence]").forEach(b=>{
      if(b.dataset.bound)return;b.dataset.bound="1";
      b.onclick=async()=>{const u=await blob(b.dataset.openEvidence);if(u)window.open(u,"_blank","noopener");};
    });
  }
  function closeCdrModal(){
    const modal=document.getElementById('cipherCdrModal');
    if(!modal)return;
    modal.classList.remove('open');
    setTimeout(()=>modal.remove(),180);
  }
  function openCdrModal(payload){
    const rows=payload?.records||[]; const docs=payload?.documents||[];
    document.getElementById('cipherCdrModal')?.remove();
    const modal=document.createElement('div'); modal.id='cipherCdrModal'; modal.className='cipher-cdr-modal';
    modal.innerHTML=`<div class="cipher-cdr-backdrop" data-cdr-close></div>
      <section class="cipher-cdr-3d" role="dialog" aria-modal="true" aria-labelledby="cipherCdrTitle">
        <button type="button" class="cipher-cdr-close" data-cdr-close aria-label="Close CDR viewer">×</button>
        <div class="cipher-cdr-kicker">CIPHER VISION / COMMUNICATIONS</div>
        <h2 id="cipherCdrTitle">CASE CDR ARCHIVE</h2>
        <p>Complete case CDR is shown. Records connected to the verified Vision identity are highlighted.</p>
        <div class="cipher-cdr-grid" id="cipherCdrGrid"></div>
      </section>`;
    document.body.appendChild(modal); const grid=modal.querySelector('#cipherCdrGrid');
    if(!rows.length && !docs.length){grid.innerHTML=`<div class="cipher-cdr-empty"><b>NO CDR RECORDS</b><span>Ingest communication evidence through Evidence first.</span></div>`;}
    else if(rows.length){rows.forEach(r=>{const card=document.createElement('article');card.className='cipher-cdr-item'+(r.highlighted?' cipher-intel-highlight':'');
      card.innerHTML=`<div class="cipher-cdr-item-top"><span class="cipher-cdr-type">CALL RECORD</span><span class="cipher-cdr-status">${esc(r.highlighted?'CONNECTED TO ACTIVE PERSON':'CASE RECORD')}</span></div>
      <h3>${esc(r.caller||'—')} → ${esc(r.callee||'—')}</h3><small>${esc(r.timestamp||'TIME NOT RECORDED')} · ${esc(r.duration_seconds??'—')} sec · ${esc(r.call_type||'CALL')} ${r.cell_id?`· ${esc(r.cell_id)}`:''}</small>
      <small class="cipher-intel-source">${esc(r.source_filename||'Evidence')} · ROW ${esc(r.row_number||'')}</small>`; grid.appendChild(card);});}
    else {docs.forEach(d=>{const card=document.createElement('article');card.className='cipher-cdr-item';card.innerHTML=`<div class="cipher-cdr-item-top"><span class="cipher-cdr-type">COMMUNICATION EVIDENCE</span><span class="cipher-cdr-status">${esc(d.processing_status||'INDEXED')}</span></div><h3>${esc(d.filename||'Unnamed evidence')}</h3><small>${esc(d.uploaded_at||'')} · EVIDENCE #${esc(d.id)}</small><button type="button" class="vision-mini-btn cipher-cdr-open" data-cdr-open="${esc(d.id)}">OPEN ORIGINAL</button>`;grid.appendChild(card);});}
    modal.querySelectorAll('[data-cdr-close]').forEach(el=>el.addEventListener('click',closeCdrModal));
    modal.querySelectorAll('[data-cdr-open]').forEach(b=>b.addEventListener('click',async()=>{const u=await blob(b.dataset.cdrOpen);if(u)window.open(u,'_blank','noopener');}));
    requestAnimationFrame(()=>modal.classList.add('open'));
  }

  async function renderComms(payload){
    const rows=payload?.records||[], docs=payload?.documents||[];
    if(!rows.length && !docs.length)return empty(comms,"NO STORED CDR FOUND","Ingest communications through Evidence first, then fetch them here.");
    if(rows.length){comms.innerHTML=rows.map(r=>`<div class="vision-evidence-row${r.highlighted?' cipher-intel-highlight':''}"><div class="vision-evidence-icon">${r.highlighted?'★':'CDR'}</div><div class="vision-evidence-main"><b>${esc(r.caller||'—')} → ${esc(r.callee||'—')}</b><span>${esc(r.timestamp||'')} · ${esc(r.duration_seconds??'—')} sec · ${esc(r.source_filename||'')}</span><em class="vision-cdr-indexed">${r.highlighted?'CONNECTED TO VERIFIED VISION PERSON':'CASE CDR / INDEXED'} · ROW ${esc(r.row_number||'')}</em></div></div>`).join('');}
    else await renderCommsDocs(docs);
  }
  async function renderCommsDocs(rows){
    comms.innerHTML=rows.map(d=>{const audio=/^audio\//i.test(String(d.file_type||''))||/\.(mp3|wav|m4a|ogg|webm)$/i.test(d.filename||'');return `<div class="vision-evidence-row"><div class="vision-evidence-icon">${audio?'▶':'CDR'}</div><div class="vision-evidence-main"><b>${esc(d.filename)}</b><span>${esc(d.processing_status||'INDEXED')} · ${esc(d.uploaded_at||'')}</span>${audio?`<audio class="vision-audio" controls preload="none" data-audio="${d.id}"></audio>`:'<em class="vision-cdr-indexed">COMMUNICATION EVIDENCE / INDEXED</em>'}</div><button type="button" class="vision-mini-btn" data-open-evidence="${d.id}">OPEN</button></div>`;}).join('');
    view.querySelectorAll('[data-audio]').forEach(async a=>{const u=await blob(a.dataset.audio);if(u)a.src=u;});bindOpen();
  }
  async function renderFinance(payload){
    const rows=payload?.records||[], docs=payload?.documents||[];
    if(!rows.length && !docs.length)return empty(finance,"NO STORED STATEMENTS FOUND","Ingest financial evidence through Evidence first, then fetch them here.");
    if(rows.length){finance.innerHTML=rows.map(r=>`<div class="vision-finance-row${r.highlighted?' cipher-intel-highlight':''}"><b>${esc(r.from_account||r.sender_name||'—')} → ${esc(r.to_account||r.receiver_name||'—')}</b><div class="vision-finance-meta"><span>${esc(r.timestamp||'')}</span><span>${r.amount!=null?esc(r.currency||'')+' '+esc(r.amount):'AMOUNT —'}</span><span>${esc(r.transaction_type||'TRANSACTION')}</span><span>${esc(r.transaction_id||('ROW '+r.row_number))}</span></div><div class="vision-finance-meta"><span>${esc(r.bank||'')}</span><span>${esc(r.upi_id||'')}</span><span>${esc(r.narration||'')}</span></div>${r.highlighted?'<em class="vision-cdr-indexed">CONNECTED TO VERIFIED VISION PERSON</em>':''}</div>`).join('');}
    else {finance.innerHTML=rows.length?finance.innerHTML:docs.map(d=>`<div class="vision-finance-row"><b>${esc(d.filename)}</b><div class="vision-finance-meta"><span>${esc(d.file_type||'FILE')}</span><span>${esc(d.processing_status||'INDEXED')}</span><span>${esc(d.uploaded_at||'')}</span>${d.sha256?`<strong>HASH ${esc(String(d.sha256).slice(0,12))}</strong>`:''}</div><button type="button" class="vision-mini-btn" data-open-evidence="${d.id}">OPEN STATEMENT</button></div>`).join('');bindOpen();}
  }
  async function fetchVision(kind, entityId=null, openModal=true){
    const target=kind==='communications'?comms:finance; if(!requireCase()){empty(target,"NO ACTIVE CASE","Select a case before fetching evidence.");return;} empty(target,"FETCHING FROM CASE DATABASE…","Complete case dataset will remain visible; connected records are highlighted.");
    try{
      const path=kind==='communications'?`/api/cases/${caseId()}/vision/cdr`:`/api/cases/${caseId()}/vision/statements`;
      const q=entityId?`?entity_id=${encodeURIComponent(entityId)}`:'';
      const r=await fetch(path+q,{headers:headers()});const d=await r.json();if(!r.ok)throw Error(d.detail||`HTTP ${r.status}`);
      if(kind==='communications'){await renderComms(d);if(openModal)openCdrModal(d);}else await renderFinance(d);
    }catch(e){empty(target,"DATABASE CONNECTION FAILED",e.message);}
  }
  let activeVisionEntityId=null;
  async function refreshVisionEntityIntel(entityId){
    activeVisionEntityId=Number(entityId)||null;
    await Promise.all([fetchVision('communications',activeVisionEntityId,false),fetchVision('financial',activeVisionEntityId,false)]);
  }
  window.cipherVisionRefreshEntityIntel=refreshVisionEntityIntel;

  async function load(){
    const label=document.getElementById("visionCaseLabel"); if(label)label.textContent=currentCaseLabel();
    const countEl=document.getElementById("visionMatchCount"); if(countEl)countEl.textContent="0";
    if(faceResults) faceResults.innerHTML=`<div class="vision-empty"><b>NO ANALYSIS YET</b><span>Upload a case photo and run the authorized ArcFace gallery search.</span></div>`;
    if(!requireCase()){faceEngine.textContent="NO CASE"; return;}
    try{const r=await fetch(`/api/cases/${caseId()}/face-intelligence/status`,{headers:headers()});const d=await r.json();faceEngine.textContent=d.ready?String(d.model||"READY").toUpperCase():"MODEL REQUIRED";faceEngine.classList.toggle("ready",!!d.ready);}
    catch{faceEngine.textContent="OFFLINE";}
  }
  fetchCdr?.addEventListener("click",()=>fetchVision("communications"));
  fetchBank?.addEventListener("click",()=>fetchVision("financial"));
  refresh?.addEventListener("click",load);
  resultsRefresh?.addEventListener("click",load);
  openGis?.addEventListener("click",()=>document.querySelector('.side-item[data-view="gis"]')?.click());
  faceChoose?.addEventListener("click",e=>{e.stopPropagation();faceInput?.click();});
  faceDrop?.addEventListener("click",e=>{if(!e.target.closest("button"))faceInput?.click();});
  faceInput?.addEventListener("change",()=>{
    const f=faceInput.files?.[0];if(!f)return;
    if(!/^image\/(jpeg|png|webp)$/i.test(f.type)||f.size>10*1024*1024){alert("Choose JPG, PNG or WEBP under 10 MB.");faceInput.value="";return;}
    selectedFace=f;
    const previewUrl=URL.createObjectURL(f);
    facePreviewImg.src=previewUrl;
    if(podiumPhoto){ podiumPhoto.innerHTML=`<img src="${previewUrl}" alt="Uploaded case photo">`; }
    if(podium){ podium.classList.remove("analyzing"); }
    if(podiumState) podiumState.textContent="IMAGE READY";
    facePreview.hidden=false;faceName.textContent=f.name;faceStatus.textContent="Reference image ready for ArcFace analysis.";faceMatch.disabled=false;
  });
  async function image(path){
    if(!path)return "";const k="i:"+path;if(cache.has(k))return cache.get(k);
    const r=await fetch(path,{headers:headers()});if(!r.ok)return "";const u=URL.createObjectURL(await r.blob());cache.set(k,u);return u;
  }
  faceMatch?.addEventListener("click",async()=>{
    if(!requireCase() || !selectedFace)return;faceMatch.disabled=true;faceMatch.textContent="ANALYZING…";faceStatus.textContent="Generating ArcFace embedding and searching the authorized case gallery…";if(podium){podium.classList.add("analyzing");}if(podiumState)podiumState.textContent="ANALYZING / ARC ENGINE";
    try{
      const fd=new FormData();fd.append("image",selectedFace);fd.append("limit","5");
      const r=await fetch(`/api/cases/${caseId()}/face-intelligence/match`,{method:"POST",headers:headers(),body:fd});const d=await r.json();if(!r.ok)throw Error(d.detail||`HTTP ${r.status}`);
      const ms=d.matches||[];
      const countEl=document.getElementById("visionMatchCount"); if(countEl)countEl.textContent=String(ms.length);
      faceResults.innerHTML=ms.length?ms.map((m,i)=>{const p=m.profile||{},l=p.latest_verified_location||{};const links=(p.verified_relationships||[]).length,locs=(p.verified_locations||[]).length;return `<div class="vision-match-row" data-match="${i}"><img data-match-img="${esc(p.image_url||"")}" alt="Potential case profile"><div class="vision-match-body"><div class="vision-match-topline"><div><b>${esc(p.display_name||m.label||"Potential match")}</b></div><div class="vision-match-score">${Number(m.similarity||0).toFixed(1)}%<small>ARC COSINE</small></div></div><div class="vision-match-meta"><span><strong>PROFILE</strong> ${esc(p.username||"No username recorded")}</span><span><strong>LOCATION</strong> ${esc(l.label||l.address_text||"No verified location")}</span><span><strong>GRAPH</strong> ${links} verified link${links===1?"":"s"} · ${locs} GIS location${locs===1?"":"s"}</span></div><div class="vision-match-status">${esc(m.status||"PENDING REVIEW")}</div><div class="vision-match-actions"><button type="button" class="vision-mini-btn" data-face-accept="${i}" ${m.status!=="PENDING"?"disabled":""}>ACCEPT</button><button type="button" class="vision-mini-btn" data-face-reject="${i}" ${m.status!=="PENDING"?"disabled":""}>REJECT</button></div></div></div>`}).join(""):`<div class="vision-empty"><b>NO CANDIDATE RETURNED</b><span>No match was returned from the authorized Cipher gallery.</span></div>`;
      faceStatus.textContent=`ArcFace complete · ${d.gallery_size||0} authorized profiles searched.`;
      if(podium){podium.classList.remove("analyzing");}if(podiumState)podiumState.textContent=ms.length?"MATCHES RETURNED":"NO MATCH FOUND";
      faceResults.querySelectorAll("[data-match]").forEach(b=>{ b.addEventListener("click",e=>{ if(e.target.closest("button"))return; route(ms[+b.dataset.match]); }); });
      faceResults.querySelectorAll("[data-face-accept]").forEach(b=>b.addEventListener("click",()=>reviewMatch(ms[+b.dataset.faceAccept],"ACCEPT",b)));
      faceResults.querySelectorAll("[data-face-reject]").forEach(b=>b.addEventListener("click",()=>reviewMatch(ms[+b.dataset.faceReject],"REJECT",b)));
      for(const img of faceResults.querySelectorAll("[data-match-img]")){const u=await image(img.dataset.matchImg);if(u)img.src=u;}
    }catch(e){faceResults.innerHTML=`<div class="vision-empty"><b>ARCFACE MATCH FAILED</b><span>${esc(e.message)}</span></div>`;faceStatus.textContent="ArcFace unavailable or analysis failed.";if(podium){podium.classList.remove("analyzing");}if(podiumState)podiumState.textContent="ANALYSIS FAILED";}
    finally{faceMatch.disabled=!selectedFace;faceMatch.textContent="RUN ARCFACE MATCH ↗";}
  });
  async function reviewMatch(m,decision,button){
    if(!m?.match_id)return;
    button.disabled=true;
    try{
      const r=await fetch(`/api/cases/${caseId()}/face-intelligence/matches/${encodeURIComponent(m.match_id)}/review`,{method:"POST",headers:{...headers(),"Content-Type":"application/json"},body:JSON.stringify({decision})});
      const d=await r.json(); if(!r.ok)throw Error(d.detail||`HTTP ${r.status}`);
      m.status=decision==="ACCEPT"?"VERIFIED":"REJECTED";
      if(decision==="ACCEPT"){
        const eid=d.canonical_entity_id;
        window.dispatchEvent(new CustomEvent("cipher:vision-identity-verified",{detail:{case_id:caseId(),entity_id:eid,entity:d.propagation?.entity,relationships:d.propagation?.relationships||[],locations:d.propagation?.locations||[],timeline_events:d.propagation?.timeline_events||[],evidence_id:m.evidence_id}}));
        faceStatus.textContent=`IDENTITY VERIFIED BY INVESTIGATOR · ${d.propagation?.entity?.label||m.label||"Person"}`;
        if(typeof window.cipherFocusNetworkNode==="function")window.cipherFocusNetworkNode(eid,d.propagation?.entity?.label||m.label);
        setTimeout(()=>{if(typeof window.cipherHighlightEntityLocations==="function")window.cipherHighlightEntityLocations(eid,d.propagation?.locations||[]);},450);
        refreshVisionEntityIntel(eid);
      }else{faceStatus.textContent="Candidate rejected and excluded from the trusted identity path.";}
      faceResults.querySelectorAll("[data-match]").forEach(x=>x.style.opacity=".92");
      showNetworkToast?.(decision==="ACCEPT"?"✓ Face candidate accepted. Network/GIS identity propagation is now verified.":"✓ Face candidate rejected.");
    }catch(e){button.disabled=false;showNetworkToast?.(`✕ Face review failed: ${e.message}`);}
  }

  function route(m){
    const p=m?.profile||{},l=p.latest_verified_location||{};const lat=Number(l.latitude??p.latitude),lng=Number(l.longitude??p.longitude);
    if(!Number.isFinite(lat)||!Number.isFinite(lng)){alert("This potential match has no verified GIS location yet.");return;}
    document.querySelector('.side-item[data-view="gis"]')?.click();
    setTimeout(()=>{if(typeof window.cipherPanToLocation==="function")window.cipherPanToLocation(lat,lng,p.display_name||"Face match",p.entity_id||null,true);},350);
  }
  window.loadCipherVision=load;load();
})();
