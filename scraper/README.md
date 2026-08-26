# FPSC & WAPDA Consolidated Advertisement PDF Scraper Pipeline

Government agencies in Pakistan such as **FPSC (Federal Public Service Commission)**, **WAPDA (Water & Power Development Authority)**, **PPSC**, **SPSC**, **KPPSC**, and **NTS** publish recruitment notices as **Consolidated Gazette PDF documents** rather than individual HTML web pages. A single PDF typically contains **10 to 40 distinct case vacancies**.

This scraper pipeline parses these consolidated PDF files using `pdfplumber` and `PyPDF2`.

---

## 🚀 Key Features

1. **`pdfplumber` Visual Layout & Table Parsing**:
   - Parses multi-column gazette PDF pages.
   - Extracts tabular vacancy breakdowns (e.g. WAPDA Engineering, Accounts, and Medical cadres).
   - Preserves text coordinate relationships to prevent column merging.

2. **`PyPDF2` Stream Parsing Fallback**:
   - Provides fast fallback for standard linear text streams and password-less gazettes.

3. **Intelligent Government Gazette Regex Engine**:
   - **Case Number / Serial Identifier**: `r'(?:Case\s*No\.?)\s*([Ff]\.4-\d+/\d+-[A-Za-z0-9\(\)\-]+)'`
   - **Pay Scale (BPS)**: `BPS-16`, `BPS-17`, `BPS-18`, `BPS-19`, `BPS-20+`
   - **Regional & Provincial Quota**: Punjab, Sindh (Urban/Rural), Khyber Pakhtunkhwa, Balochistan, Ex-FATA, AJK, Gilgit-Baltistan, Minorities & Women Quotas.
   - **Age & Relaxation Calculations**: Standard age limits plus 5-year federal general relaxation.
   - **Challan Fee Tier Mapping**: Automatic computation of NBP challan fee (Rs. 300 for BPS-16/17, Rs. 750 for BPS-18, Rs. 1200 for BPS-19).

---

## 📦 Python Dependencies

```bash
pip install pdfplumber PyPDF2 requests pydantic
```

---

## 💻 CLI Usage

```bash
python scraper/fpsc_wapda_pdf_scraper.py
```

---

## 🌐 In-App Integration
The Career Pakistan Admin Dashboard includes a dedicated **Consolidated PDF Advertisement Parser & Batch Ingestor** that provides:
- Live parsing of uploaded or pre-loaded FPSC/WAPDA PDF files.
- Visual inspection of each extracted vacancy card before publishing.
- One-click batch ingestion into the Live Job Portal and Scraped History Audit Ledger.
