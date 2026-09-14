# DataPilot 15-Minute Demo Workflow

This document walks through a complete end-to-end scenario demonstrating DataPilot's capabilities.

---

## Scenario: E-Commerce Sales & Customer Analytics

### Step 1: Import Demo Dataset
1. Navigate to **Data Import**.
2. Upload `sales_demo.csv` (or use the built-in demo fixture).
3. Verify column types (`customer_id`, `order_date`, `product_category`, `revenue`, `status`).

### Step 2: Data Quality & Profiling
1. Open **Data Quality**.
2. Examine the Data Health Score (e.g., 94%).
3. Review missing value alerts and outlier detection in the revenue column.

### Step 3: Cleaning & Transformation
1. Go to **Cleaning**.
2. Add a transformation step: Trim whitespace on `product_category`.
3. Add a second step: Impute missing revenue values with the median.

### Step 4: SQL Analysis
1. Switch to the **SQL Workspace**.
2. Run an analytical query:
   ```sql
   SELECT product_category, SUM(revenue) AS total_revenue, COUNT(*) AS order_count
   FROM cleaned_sales
   GROUP BY product_category
   ORDER BY total_revenue DESC;
   ```
3. Save the query to your query library.

### Step 5: Visualization & Dashboard
1. Open **Visualization Studio** and create a Bar Chart of total revenue by product category.
2. Navigate to **Dashboards**, create a new dashboard titled "Executive Sales Q3", and add your bar chart widget.
3. Configure global date and category filters.

### Step 6: Reports & Export
1. Generate an immutable **Snapshot** and summary report.
2. Export the final dataset to Excel with formula sanitization enabled.
