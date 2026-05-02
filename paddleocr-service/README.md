# PaddleOCR Service

This directory contains the PaddleOCR service files for FileFlow's OCR functionality.

## Structure

```
paddleocr-service/
├── README.md              # This file
├── models/                # PaddleOCR model files (downloaded separately)
│   ├── det/               # Detection model
│   ├── rec/               # Recognition model
│   └── cls/               # Classification model
├── python/                # Portable Python runtime (optional)
│   └── python.exe         # Windows standalone Python
├── requirements.txt       # Python dependencies
└── start_server.py        # PaddleOCR HTTP server script
```

## Setup Instructions

### Option 1: Python-based PaddleOCR (Recommended)

1. Download a portable Python runtime and place it in `python/`
2. Install dependencies:
   ```bash
   python/python.exe -m pip install -r requirements.txt
   ```
3. Download PaddleOCR models and place them in `models/`

### Option 2: Pre-built Executable

Place the pre-built `paddleocr_server.exe` in this directory.

## Starting the Service

```bash
# Python mode
python/python.exe start_server.py --port 8866

# Or run the executable directly
paddleocr_server.exe --port 8866
```

## Health Check

The service exposes a health endpoint at:
- `http://localhost:8866/health`

## License

PaddleOCR is licensed under the Apache License 2.0.
See: https://github.com/PaddlePaddle/PaddleOCR
