# CIPHER Face Runtime Fix

- Replaced the old InsightFace 0.7.3 source-build requirement with `insightface==2.0`.
- Kept NumPy consistent at `>=1.26,<3`.
- Allowed current OpenCV 4.x/5.x wheels with `opencv-python-headless>=4.10,<6`.
- Kept ONNX Runtime on the 1.x line.
- Unified the polished Face Intelligence wrapper with the canonical `face_engine.py` cache/model initialization.
- Fixed a runtime `numpy` NameError in `face_intelligence.detect_face`.
- Removed a duplicate `_face_public` helper.
- Setup now verifies NumPy/OpenCV/ONNX/InsightFace imports before model preflight.
