# PaddleOCR-json 部署目录

## 下载说明

1. 访问 [PaddleOCR-json Releases](https://github.com/hiroi-sora/PaddleOCR-json/releases)
2. 下载最新 Windows 版本（如 `PaddleOCR-json_v1.3.1_Windows.7z`）
3. 解压后将**所有内容**放入此目录：
   - `PaddleOCR-json.exe`（或 `PaddleOCR-json_v*.exe`）
   - `models/` 文件夹（包含所有模型文件）
   - 所有 `.dll` 文件（PaddleInference.dll、mkldnn.dll、opencv_world*.dll 等）

## 目录结构示例

```
paddleocr-json/
├── PaddleOCR-json.exe
├── PaddleInference.dll
├── mkldnn.dll
├── mklml.dll
├── opencv_world470.dll
├── (其他 .dll 文件)
├── models/
│   ├── ch_PP-OCRv4_det_infer/
│   ├── ch_PP-OCRv4_rec_infer/
│   └── ...
└── README.md（本文件）
```

## 许可协议

PaddleOCR-json 采用 Apache License 2.0
项目地址：https://github.com/hiroi-sora/PaddleOCR-json
