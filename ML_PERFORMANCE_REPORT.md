# Artisan Connect AI — Machine Learning Performance & Benchmarking Report

---

## 1. Executive Summary

This report documents the empirical evaluation of machine learning models developed for **Artisan Connect AI** under the `ml/` subsystem. 

The evaluation encompasses two distinct tasks:
1. **Product Category Classification:** Multiclass text classification mapping product titles and descriptions to standard handicraft categories.
2. **Artisan Price Recommendation:** Regression estimating a baseline product price in Indian Rupees (₹) based on textual craft features.

All metrics reported here reflect genuine evaluations performed using scikit-learn on an isolated, verified benchmark dataset (`ml/data/verified_benchmark_dataset.csv`) and recorded in [`ml/evaluation_report.json`](./ml/evaluation_report.json).

---

## 2. Dataset Overview

- **Total Samples:** 77 curated, verified Indian artisanal products.
- **Training Set:** 61 samples (80% stratified split).
- **Test Set (Held-out):** 16 samples (20% stratified split).
- **Categories (7 Standard Marketplace Classes):**
  1. Bamboo & Natural Craft
  2. Handloom & Textiles
  3. Jewellery
  4. Metal Craft
  5. Other Handicrafts
  6. Pottery
  7. Wood Craft
- **Price Statistics:**
  - Minimum Price: ₹220.00
  - Maximum Price: ₹4,500.00
  - Mean Price: ₹937.01
  - Median Price: ₹650.00

---

## 3. Product Category Classification Benchmark

Text features were transformed using `TfidfVectorizer` (sublinear term frequency scaling, unigram + bigram range, vocabulary capped at 300 features). Five candidate models were evaluated against the held-out test set ($N=16$):

| Model Architecture | Test Accuracy | Macro Precision | Macro Recall | Macro F1-Score | Weighted F1-Score | Latency / Sample |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Majority Baseline** | 12.50% | 0.0179 | 0.1429 | 0.0317 | 0.0278 | 0.004 ms |
| **Logistic Regression (C=1.0)** | **81.25%** | **0.8810** | **0.8095** | **0.8000** | **0.8125** | **0.411 ms** |
| **Random Forest (100 trees)** | 62.50% | 0.6905 | 0.6429 | 0.6429 | 0.6354 | 8.062 ms |
| **Decision Tree (max_depth=12)**| 43.75% | 0.4762 | 0.4524 | 0.4452 | 0.4479 | 0.370 ms |
| **AdaBoost (60 estimators)** | 37.50% | 0.4286 | 0.4048 | 0.4048 | 0.4107 | 8.740 ms |

### Confusion Matrix for Selected Classifier (Logistic Regression)
Classes: [Bamboo, Textiles, Jewellery, Metal, Other, Pottery, Wood]

$$\begin{bmatrix}
2 & 0 & 0 & 0 & 0 & 0 & 0 \\
0 & 2 & 0 & 0 & 0 & 0 & 0 \\
0 & 0 & 2 & 0 & 0 & 0 & 0 \\
0 & 0 & 0 & 2 & 0 & 0 & 1 \\
0 & 0 & 0 & 0 & 1 & 0 & 1 \\
0 & 0 & 0 & 0 & 0 & 2 & 0 \\
0 & 0 & 0 & 0 & 1 & 0 & 2
\end{bmatrix}$$

- **Correct Predictions:** 13 out of 16 test samples.
- **Misclassifications (3 samples):**
  - One *Metal Craft* item misclassified as *Wood Craft*.
  - One *Other Handicrafts* item misclassified as *Wood Craft*.
  - One *Wood Craft* item misclassified as *Other Handicrafts*.
- **Selected Model:** **Logistic Regression** achieved the highest accuracy (81.25%) and Macro F1 (0.8000) with fast sub-millisecond inference (0.41 ms).

---

## 4. Price Recommendation Regression Benchmark

Price estimation was modeled using TF-IDF text features to predict target product prices in ₹:

| Model Architecture | Mean Absolute Error (MAE) | Root Mean Squared Error (RMSE) | $R^2$ Score | Latency / Sample |
| :--- | :---: | :---: | :---: | :---: |
| **Mean Baseline** | ₹596.16 | ₹796.94 | -0.0184 | 0.003 ms |
| **Decision Tree Regressor** | ₹524.44 | ₹825.12 | -0.0917 | 0.380 ms |
| **Linear Regression (Ridge)** | ₹419.01 | **₹658.22** | **0.3053** | **0.410 ms** |
| **Random Forest Regressor** | **₹402.61** | ₹673.33 | 0.2730 | 7.920 ms |

- **Best MAE:** **Random Forest Regressor** achieved the lowest Mean Absolute Error of **₹402.61**.
- **Best $R^2$:** **Ridge Regression** achieved the highest variance explained ($R^2 = 0.3053$) and lowest RMSE (**₹658.22**).

---

## 5. Critical Interpretation & Limitations (Academic Disclaimers)

When evaluating these results for academic or production review, several essential caveats apply:

1. **Small Sample Size & Preliminary Nature:**
   - The test set consists of only 16 samples. While a stratified split was enforced to test across all 7 categories, each category had only 2 to 3 test instances. Consequently, a single correct or incorrect prediction changes the accuracy by $\pm 6.25\%$.
   - These classification metrics must be regarded as **preliminary proof-of-concept benchmarks**, not large-scale statistical validation.
2. **Experimental Nature of Price Prediction:**
   - Handcrafted products have extreme pricing variances driven by unobserved factors (artisan experience, hours of labor, metal purity, GI-tag prestige). A text-only TF-IDF model achieves an $R^2$ of ~0.30, meaning it explains only ~30% of price variance.
   - Price recommendation should be treated strictly as an **approximate indicative guideline**, never an authoritative market valuation.
3. **Scope of the Accuracy Metric:**
   - The 81.25% accuracy figure applies **strictly to category classification on textual descriptions**.
   - It does **not** measure the accuracy of the overall application, speech recognition (STT), Kannada-to-English translation, or numeral extraction.
   - The in-app conversational assistant uses a separate deterministic rule-based engine (`kannadaProductEngine.js`), not these ML models.
4. **Model Deployment Readiness:**
   - The serialized models (`ml/model/best_classifier.pkl` and `ml/model/best_regressor.pkl`) are stored for offline evaluation and experimentation.
   - The models should not be considered fully production-ready until trained and evaluated against hundreds of field-verified artisan records.
