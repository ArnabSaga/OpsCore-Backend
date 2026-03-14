# ⚙️ OpsCore: Multi-Tenant Workspace & Operations Platform

### Product Requirements Document (PRD)

---

# 📌 Project Overview

**OpsCore** is a B2B multi-tenant SaaS platform designed for **agencies, startups, and service-based companies** to manage internal operations, client projects, team collaboration, and billing from a centralized workspace.

Each organization that registers creates an isolated **Workspace (Tenant)** with its own users, projects, tasks, and operational data.

The platform enables businesses to:

* Manage team members and permissions
* Track projects and tasks
* Generate invoices and handle billing
* Monitor operational analytics
* Automate internal workflows

The system enforces:

* Strict **multi-tenant data isolation**
* **Role-Based Access Control (RBAC)**
* Secure authentication
* Seamless subscription and invoice payments

OpsCore is designed to be **scalable, modular, and secure**, following modern SaaS architecture principles.

---

# 🏗 System Architecture

```
Client (Next.js)
      ↓
API Server (Express + Node.js)
      ↓
Authentication Layer (JWT)
      ↓
Application Services
      ↓
Prisma ORM
      ↓
PostgreSQL Database
```

Optional infrastructure:

* Redis (caching)
* Docker (containerization)
* Cloud Storage (file uploads)

---

# 🏗 Technology Stack

## Frontend

* Next.js
* Tailwind CSS
* ShadCN UI
* React Hook Form
* Zod (schema validation)

## Backend

* Node.js
* Express.js
* TypeScript
* Prisma ORM

## Database

* PostgreSQL (relational multi-tenant architecture)

## Authentication

* JWT authentication
* HttpOnly secure cookies

## Payments

* Stripe integration

---

# 🎯 Core Product Features

## 1️⃣ Core Functionality

### Multi-Tenant Authentication

Users can register and create a **workspace**, automatically becoming the **Workspace Owner**.

### Workspace Management

Users can:

* Create workspace
* Switch between workspaces
* Update workspace settings
* Manage billing and subscription

---

### Role-Based Access Control (RBAC)

| Role   | Permissions                                                  |
| ------ | ------------------------------------------------------------ |
| Owner  | Full workspace control, billing management, delete workspace |
| Admin  | Manage users, projects, tasks, and invoices                  |
| Member | View assigned projects and update tasks                      |

---

### Complex CRUD Operations

The system manages relational data across:

```
Workspace → Projects → Tasks → Invoices
```

---

### Payment System

Stripe integration enables:

* Workspace subscription plans
* Invoice payment processing
* Billing management

Subscription tiers:

* **Free Plan**
* **Pro Plan**

---

# 🖥 UI / UX Design

The platform follows a **modern SaaS dashboard layout**.

### Features

* Fully responsive design
* Workspace-aware sidebar navigation
* Clean dashboard UI
* Skeleton loading states
* Dark / Light mode support
* Accessible components

---

# 🏠 Landing Page Structure

The homepage includes:

* Navbar
* Hero section
* Features section
* Pricing section
* Testimonials
* Call-to-Action (CTA)
* Footer

This ensures compliance with the **UI rubric requirements**.

---

# ⚠ Error Handling

The platform uses standardized error responses.

### Common HTTP Error Codes

* `401 Unauthorized`
* `403 Forbidden`
* `404 Not Found`
* `500 Internal Server Error`

### Validation

* Zod schema validation for all API inputs
* Form validation on frontend

### User Feedback

* Toast notifications for errors
* Clear human-readable messages

---

# 🗄 Database Architecture

Every operational table includes a:

```
workspace_id
```

This ensures strict **tenant data isolation**.

---

## 1️⃣ Workspaces

| Field              | Type      | Constraints   |
| ------------------ | --------- | ------------- |
| id                 | UUID      | Primary Key   |
| name               | String    | Not Null      |
| stripe_customer_id | String    | Nullable      |
| subscription_plan  | Enum      | `FREE`, `PRO` |
| created_at         | Timestamp |               |

---

## 2️⃣ Users

| Field         | Type      | Constraints |
| ------------- | --------- | ----------- |
| id            | UUID      | Primary Key |
| email         | String    | Unique      |
| password_hash | String    | Not Null    |
| created_at    | Timestamp |             |

---

## 3️⃣ WorkspaceMembers

RBAC pivot table linking users and workspaces.

| Field        | Type                              |
| ------------ | --------------------------------- |
| workspace_id | UUID                              |
| user_id      | UUID                              |
| role         | Enum (`OWNER`, `ADMIN`, `MEMBER`) |

---

## 4️⃣ Projects

| Field        | Type                         |
| ------------ | ---------------------------- |
| id           | UUID                         |
| workspace_id | UUID                         |
| name         | String                       |
| status       | Enum (`ACTIVE`, `COMPLETED`) |

---

## 5️⃣ Tasks

| Field               | Type                                 |
| ------------------- | ------------------------------------ |
| id                  | UUID                                 |
| project_id          | UUID                                 |
| title               | String                               |
| assigned_to_user_id | UUID                                 |
| status              | Enum (`TODO`, `IN_PROGRESS`, `DONE`) |
| due_date            | Date                                 |

---

## 6️⃣ Invoices

| Field        | Type                     |
| ------------ | ------------------------ |
| id           | UUID                     |
| workspace_id | UUID                     |
| amount       | Decimal                  |
| status       | Enum (`PENDING`, `PAID`) |

---

## 7️⃣ Subscriptions

| Field                  | Type   |
| ---------------------- | ------ |
| id                     | UUID   |
| workspace_id           | UUID   |
| stripe_subscription_id | String |
| plan                   | Enum   |
| status                 | Enum   |

---

## 8️⃣ ActivityLogs

Tracks system activity.

| Field        | Type      |
| ------------ | --------- |
| id           | UUID      |
| workspace_id | UUID      |
| user_id      | UUID      |
| action       | String    |
| created_at   | Timestamp |

---

# 🛣 API Endpoints

## Authentication

| Method | Endpoint             | Description                 |
| ------ | -------------------- | --------------------------- |
| POST   | `/api/auth/register` | Register user and workspace |
| POST   | `/api/auth/login`    | Login user                  |
| GET    | `/api/auth/me`       | Get authenticated user      |

---

## Workspace

| Method | Endpoint              | Description         |
| ------ | --------------------- | ------------------- |
| GET    | `/api/workspaces`     | Get user workspaces |
| POST   | `/api/workspaces`     | Create workspace    |
| PATCH  | `/api/workspaces/:id` | Update workspace    |

---

## Users

| Method | Endpoint                     |
| ------ | ---------------------------- |
| POST   | `/api/workspaces/:id/invite` |
| GET    | `/api/workspaces/:id/users`  |
| PATCH  | `/api/users/:id/role`        |

---

## Projects

| Method | Endpoint            |
| ------ | ------------------- |
| GET    | `/api/projects`     |
| POST   | `/api/projects`     |
| GET    | `/api/projects/:id` |
| PATCH  | `/api/projects/:id` |
| DELETE | `/api/projects/:id` |

---

## Tasks

| Method | Endpoint         |
| ------ | ---------------- |
| GET    | `/api/tasks`     |
| POST   | `/api/tasks`     |
| PATCH  | `/api/tasks/:id` |
| DELETE | `/api/tasks/:id` |

---

## Invoices

| Method | Endpoint            |
| ------ | ------------------- |
| GET    | `/api/invoices`     |
| POST   | `/api/invoices`     |
| PATCH  | `/api/invoices/:id` |

---

## Billing

| Method | Endpoint                 |
| ------ | ------------------------ |
| POST   | `/api/billing/subscribe` |
| POST   | `/api/webhooks/stripe`   |

---

# 🔒 Security Rules

## Golden Rule of Tenant Isolation

All queries must include:

```
WHERE workspace_id = currentWorkspace
```

This guarantees that no workspace can access another workspace’s data.

---

## Workspace Context Injection

The backend extracts `workspace_id` from the authenticated user's token.

Never trust workspace identifiers sent from the client.

---

## Input Security

All inputs must be sanitized to prevent:

* SQL Injection
* Cross-Site Scripting (XSS)
* Invalid payloads

---

# 🚀 Future Enhancements

Potential improvements:

* Advanced analytics dashboard
* Workflow automation
* Email notifications
* Mobile application
* Plugin ecosystem
* Webhooks and integrations
* Multi-language support

---

# 📈 Conclusion

OpsCore is a **scalable multi-tenant SaaS platform** enabling organizations to manage projects, teams, and billing inside secure workspaces.

The architecture prioritizes:

* Scalability
* Security
* Tenant isolation
* Modular system design
* Operational efficiency
