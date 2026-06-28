# VSQC Platform - Comprehensive Manual Testing & Quality Assurance Plan

This document assigns manual testing and quality assurance responsibilities to **Kartik**, **Ishaan**, **Soham**, and **Shreyash** to verify all features, roles, and real-time database integrations of the **VSQC Platform**.

## Global Test Credentials
* **App URL**: `http://localhost:3000`
* **Super Admin Email**: `admin@vsqc.com`
* **Super Admin Password**: `Admin123`

---

## Tester 1: Kartik — System Administration, Billing & Auditing
### Roles to Test: `super_admin`, `accounts`
### Scope of Testing: User administration, MFA security settings, RBAC permissions, and Financial operations.

#### Test Execution Steps:
1. **User Provisioning & Management**:
   * Log in to the platform using the **Super Admin** credentials.
   * Navigate to the **Admin Panel**.
   * Create a new user with the role of **Client Manager** (assign to **Ishaan**).
   * Create a new user with the role of **Project Manager** (assign to **Soham**).
   * Create a new user with the role of **Consultant** (assign to **Shreyash**).
   * Create a new user with the role of **Accounts**.
2. **Deactivation & Deletion Controls**:
   * Edit one of the created users, toggle their status from `Active` to `Suspended`, and verify they cannot log in.
   * Reactivate the user.
   * Verify that you can successfully **delete a Client Manager** or **Consultant** directly from the user list.
3. **MFA Configuration**:
   * Enable/disable MFA for a test user and verify the configuration updates.
4. **Permission Overrides**:
   * Select a consultant from the user list and apply a **Permission Override** (e.g. grant them access to "View AI Insights" or restrict "Approve Expenses").
   * Log in as that consultant in another window and verify the overrides take effect instantly.
5. **Billing & Finance Module**:
   * Log out and log back in as the **Accounts** user.
   * Navigate to **Billing & Finance**. Verify that since there are no invoices generated, the page displays a clean empty state: *"No invoices available to compute"* or *"No invoices found"*.
   * Click **Generate Invoice**. Choose a project from the dropdown, fill out the client name, dates, and amount. Submit it.
   * Confirm that the financial KPI cards (**Total Invoiced**, **Collected**, **Outstanding**, **Overdue**) and the **Quarterly Revenue & Collections Chart** update dynamically.
   * In the Invoice Register table, click the **Download PDF** icon on the created invoice. Verify a styled invoice PDF is generated.
   * Click **Export CSV** and verify the downloaded CSV matches the invoices list.
6. **Audit Logs & Security Trails**:
   * Log back in as **Super Admin**.
   * Navigate to the **Admin Panel** -> **Audit Logs** tab.
   * Confirm that logs are present for every action you performed (e.g., `USER_CREATED`, `INVOICE_GENERATED`, `USER_DELETED`).

---

## Tester 2: Ishaan — Client Relationship Management (CRM)
### Roles to Test: `client_manager`
### Scope of Testing: Client database, opportunity funnel, requirements mapping, and client interactions.

#### Test Execution Steps:
1. **Client Records Creation**:
   * Log in using the **Client Manager** credentials created by Kartik.
   * Navigate to the **Clients** module. Verify the empty state shows no active records.
   * Click **Add Client** and fill in details (e.g., *"Vanguard Group"*, industry, contact details). Save the client.
2. **Contact Database**:
   * Navigate to **Contacts** and click **Add Contact**.
   * Create a contact profile, assign them to your newly created client, and mark them as a **Client Contact** role.
3. **Call & Meeting Logs**:
   * Navigate to **Calls**. Click **Log Call**, enter notes, set the status (e.g., *"Connected"*), and link it to the client.
   * Navigate to **Meetings**. Click **Schedule Meeting**, assign a date, time, and attendees, and link it to the client.
   * Navigate to **Follow-ups** and verify scheduled follow-up tasks appear in the list.
4. **CRM Funnel (Opportunities)**:
   * Navigate to **Opportunities**.
   * Create an opportunity (e.g. *"Enterprise ERP Implementation"*), set a value (e.g. ₹5,00,000), probability, and stage.
   * Drag-and-drop or edit the opportunity to move it between stages (e.g., *Qualified* -> *Proposal* -> *Closed Won*).
5. **Requirements Engineering**:
   * Navigate to **Requirements**.
   * Create a requirements list for the client, set priorities (Critical, High, Medium, Low), and log status.
6. **Client Portal Security Test**:
   * Log out of the Client Manager profile.
   * Log in as the **Client Contact** user created under the Contacts section.
   * Verify that this portal only displays projects, milestones, and tasks associated with their client company, with zero cross-project visibility.

---

## Tester 3: Soham — Project Planning & Resource Allocation
### Roles to Test: `project_manager`
### Scope of Testing: Project creation, Gantt scheduling, task boards, milestones, and consultant loading.

#### Test Execution Steps:
1. **Project Onboarding**:
   * Log in using the **Project Manager** credentials created by Kartik.
   * Navigate to the **Project Portfolio**. Verify the empty state renders: *"No projects available in portfolio"*.
   * Click **Create Project**. Add a project name, select a client, set a budget (e.g. ₹10,00,000), a due date, and select its priority.
   * Confirm the portfolio metrics card and graphs update instantly.
2. **Milestone Scheduling**:
   * Go to the newly created Project Dashboard.
   * Add **Milestones** (e.g. *"Design Sign-off"*, *"UAT"*), set dates, status, and allocation amounts.
3. **Task Breakdown & Agile Board**:
   * Navigate to **Task Management**.
   * Create tasks (e.g. *"Setup Schema"*, *"Build API"*), link them to the project, set estimated hours, and assign them to the consultant (Shreyash).
   * Go to the task Board view and drag a task from `To Do` to `In Progress` and then to `Review`.
   * Open a task detail card and post a **comment**. Verify the comment logs in real time.
   * Create **Subtasks** and check them off to watch the progress bar update.
4. **Gantt Chart Timeline**:
   * Navigate to the **Gantt Chart** page.
   * Verify that the timeline renders bars for the project's milestones and tasks correctly.
5. **Resource Management**:
   * Navigate to **Resource Planning**.
   * Verify that the resource loading bar dynamically updates based on the tasks assigned to Shreyash.
   * Assign Shreyash to multiple overlapping tasks and check if the interface highlights them as over-allocated.

---

## Tester 4: Shreyash — Consultant Delivery & AI Operations
### Roles to Test: `consultant`, `senior_consultant`
### Scope of Testing: Timesheets, expense claims, leave requests, and AI Insights operations.

#### Test Execution Steps:
1. **Timesheet Entry & Submission**:
   * Log in using the **Consultant** credentials created by Kartik.
   * Navigate to **Timesheets**.
   * Select the current week. Select a project assigned to you, enter hours worked for each day (Monday-Friday), specify tasks, and mark them as *Billable* or *Non-Billable*.
   * Click **Submit Timesheet**.
2. **Leave Request Management**:
   * Navigate to **Leave Management**.
   * Click **Request Leave**. Set start/end dates, select leave type (Annual, Sick, etc.), enter the reason, and submit.
   * Log back in as Project Manager (Soham) or Super Admin (Kartik) to approve/reject the request. Confirm the status changes instantly in Shreyash's panel.
3. **Travel & Expenses Module**:
   * Navigate to **Travel & Expenses**.
   * Confirm the initial state shows zero logged spend.
   * Click **Add Expense**. Choose project, select category (e.g., *Accommodation*), amount, date, description, and save.
   * Confirm the **Spend Summary Bar Chart** and **AI Spend Insights Cards** update dynamically without `NaN%` layout errors.
4. **AI Insights Center**:
   * Navigate to the **AI Center** (or **AI Insights** page).
   * **Weekly PMO Summary**: Click to view the summary. Verify Portfolio Health, Target vs Forecast revenue, and operational recommendations compute dynamically from database projects/invoices.
   * **Task-Time Estimation**: select your task title from the dropdown, input the target team size and priority, and verify that the AI predicts task duration and confidence.
   * **Scan Delays**: Open the modal. Set a task in Soham's planner as overdue and check if the scanner lists it with estimated delays.
   * **Analyze Roots**: Verify the MCA/SPOC audit logs map active delays.
   * **Resource Clashes**: Run the Clash Detector. Confirm that if Soham assigned you to overlapping tasks, the clash table lists them properly.

---

## How to Report Bugs & Issues
If you encounter any layout issues, broken calculations, missing translations, or functional errors during testing:
1. Open a new issue or log it in your testing sheet.
2. Structure your report using the template below:
   ```markdown
   ### [Bug Title]
   * **Module/Page**: (e.g., Billing & Finance)
   * **Logged Role**: (e.g., accounts)
   * **Steps to Reproduce**:
     1. ...
     2. ...
   * **Expected Behavior**: ...
   * **Actual Behavior**: ...
   * **Screenshots/Console Errors**: ...
   ```
