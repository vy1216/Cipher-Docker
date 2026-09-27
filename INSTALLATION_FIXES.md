# CIPHER installation fixes

## Face runtime

The final corrected package uses `insightface==2.0` instead of the old `0.7.3` source distribution. InsightFace 2.0 ships a normal Python wheel and its optional `face3d` extension is not compiled by standard installation.

The ML stack is now consistent across all dependency files:

- NumPy: `>=1.26,<3`
- InsightFace: `==2.0`
- ONNX Runtime: `>=1.18,<2`
- OpenCV headless: `>=4.10,<6`

## Runtime consistency

- The polished Face Intelligence API now reuses the canonical face engine instead of initializing a second model pack.
- Fixed a NumPy runtime NameError in the Face Intelligence detector.
- The one-click setup verifies all four ML imports before starting CIPHER.
- The canonical local CIPHER server port is `8000`; auxiliary scripts and documentation were aligned to it.
