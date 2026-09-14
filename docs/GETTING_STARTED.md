# DataPilot Getting Started Guide

Welcome to **DataPilot**! This guide will help you set up, run, and start using DataPilot for your data analysis workflows in minutes.

---

## 1. Prerequisites

Before installing DataPilot, ensure your system has:
- **Node.js**: Version `22.5.0` or higher (`node -v`)
- **npm**: Version `10.0.0` or higher (`npm -v`)
- **Git**: For cloning the repository

---

## 2. Installation & Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/datapilot/datapilot.git
   cd datapilot
   ```

2. **Install Dependencies**
   ```bash
   npm ci
   ```

3. **Configure Environment Variables**
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   *Note: For local development, SQLite is used out-of-the-box. No external database setup is required for initial trials.*

4. **Start the Development Server**
   ```bash
   npm run dev
   ```
   The application will start on port `3000` (`http://localhost:3000`).

---

## 3. First Login & Workspace Tour

1. Open `http://localhost:3000` in your browser.
2. You will be greeted by the default workspace login session.
3. Explore the main navigation sidebar:
   - **Workspace & Projects**: Manage multi-tenant workspaces and projects.
   - **Data Import**: Upload CSV, XLSX, or JSON files.
   - **Data Quality**: Review automated profiling and health scores.
   - **Cleaning & Transformations**: Apply non-destructive data cleaning pipelines.
   - **SQL Workspace**: Run secure read-only queries with autocomplete and explain plans.
   - **Visualization Studio**: Build interactive charts.
   - **Dashboards**: Combine multiple charts and KPIs with global filters.
   - **Reports & Collaboration**: Share insights, capture immutable snapshots, and audit activity.

---

## 4. Your First 10-Minute Workflow

1. **Import a Dataset**: Click **Data Import**, drag and drop a sample CSV file, and register it.
2. **Review Data Quality**: Navigate to **Data Quality** to inspect missing values, duplicates, and column distributions.
3. **Clean the Data**: Go to **Cleaning**, apply a text trim or missing value imputation step, and preview changes.
4. **Run SQL**: Open the **SQL Editor**, select your imported table, and execute a query like `SELECT * FROM imported_table LIMIT 10`.
5. **Create a Chart**: Switch to **Visualization**, pick your dataset, select a bar chart, and group by category.
6. **Build a Dashboard**: Add your chart to a **Dashboard**, save your layout, and export the final dataset securely.

---

## 5. Troubleshooting

- **Port 3000 In Use**: Ensure no other service is binding to port 3000. DataPilot is hardcoded to port 3000 for container and proxy ingress.
- **Node Version Mismatch**: If you encounter syntax errors, verify you are running Node 22+ (`node -v`).
