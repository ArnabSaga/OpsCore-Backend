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

* Better Auth
* cookie/session based auth

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
* **Enterprise Plan**

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

# 🛣 OpsCore API Endpoints

---

# 🔐 Authentication

| Method | Endpoint | Description |
|------|------|------|
| POST | `/api/auth/register` | Register user and create workspace |
| POST | `/api/auth/login` | Login user |
| POST | `/api/auth/logout` | Logout user |
| GET | `/api/auth/me` | Get authenticated user |
| POST | `/api/auth/forgot-password` | Send password reset link |
| POST | `/api/auth/reset-password` | Reset password |
| POST | `/api/auth/change-password` | Change password for logged-in user |
| POST | `/api/auth/verify-email` | Verify user email |
| POST | `/api/auth/resend-verification` | Resend verification email |

---

# 🏢 Workspaces

| Method | Endpoint | Description |
|------|------|------|
| GET | `/api/workspaces` | Get all workspaces of authenticated user |
| POST | `/api/workspaces` | Create a new workspace |
| GET | `/api/workspaces/:workspaceId` | Get single workspace details |
| PATCH | `/api/workspaces/:workspaceId` | Update workspace settings |
| DELETE | `/api/workspaces/:workspaceId` | Delete workspace (Owner only) |
| POST | `/api/workspaces/:workspaceId/switch` | Switch active workspace |

---

# 👥 Workspace Members

> Role belongs to the **workspace membership**, not the global user.

| Method | Endpoint | Description |
|------|------|------|
| GET | `/api/workspaces/:workspaceId/members` | Get all members of a workspace |
| PATCH | `/api/workspaces/:workspaceId/members/:memberId` | Update member role/status |
| DELETE | `/api/workspaces/:workspaceId/members/:memberId` | Remove member from workspace |

---

# ✉️ Invitations

| Method | Endpoint | Description |
|------|------|------|
| GET | `/api/workspaces/:workspaceId/invitations` | Get all workspace invitations |
| POST | `/api/workspaces/:workspaceId/invitations` | Invite a user to workspace |
| DELETE | `/api/workspaces/:workspaceId/invitations/:invitationId` | Cancel invitation |
| POST | `/api/invitations/:token/accept` | Accept workspace invitation |
| POST | `/api/invitations/:token/decline` | Decline workspace invitation |

---

# 📁 Projects

| Method | Endpoint | Description |
|------|------|------|
| GET | `/api/projects` | Get all projects in active workspace |
| POST | `/api/projects` | Create a project |
| GET | `/api/projects/:projectId` | Get single project details |
| PATCH | `/api/projects/:projectId` | Update project |
| DELETE | `/api/projects/:projectId` | Delete project |

### Nested Project Routes

| Method | Endpoint | Description |
|------|------|------|
| GET | `/api/projects/:projectId/tasks` | Get tasks of a specific project |
| GET | `/api/projects/:projectId/members` | Get project members |
| POST | `/api/projects/:projectId/members` | Assign members to project |

---

# ✅ Tasks

| Method | Endpoint | Description |
|------|------|------|
| GET | `/api/tasks` | Get all tasks in active workspace |
| POST | `/api/tasks` | Create a task |
| GET | `/api/tasks/:taskId` | Get single task details |
| PATCH | `/api/tasks/:taskId` | Update task |
| DELETE | `/api/tasks/:taskId` | Delete task |

### Task Extensions

| Method | Endpoint | Description |
|------|------|------|
| GET | `/api/tasks/:taskId/comments` | Get task comments |
| POST | `/api/tasks/:taskId/comments` | Add comment to task |
| PATCH | `/api/tasks/:taskId/comments/:commentId` | Update comment |
| DELETE | `/api/tasks/:taskId/comments/:commentId` | Delete comment |
| GET | `/api/tasks/:taskId/attachments` | Get task attachments |
| POST | `/api/tasks/:taskId/attachments` | Upload task attachment |
| DELETE | `/api/tasks/:taskId/attachments/:attachmentId` | Delete attachment |

---

# 💳 Invoices

| Method | Endpoint | Description |
|------|------|------|
| GET | `/api/invoices` | Get all invoices in active workspace |
| POST | `/api/invoices` | Create invoice |
| GET | `/api/invoices/:invoiceId` | Get invoice details |
| PATCH | `/api/invoices/:invoiceId` | Update invoice |
| DELETE | `/api/invoices/:invoiceId` | Delete or archive invoice |
| POST | `/api/invoices/:invoiceId/send` | Send invoice |
| POST | `/api/invoices/:invoiceId/mark-paid` | Mark invoice as paid |
| POST | `/api/invoices/:invoiceId/cancel` | Cancel invoice |

---

# 💰 Billing & Subscription

| Method | Endpoint | Description |
|------|------|------|
| GET | `/api/billing/subscription` | Get current workspace subscription |
| POST | `/api/billing/checkout-session` | Create Stripe checkout session |
| POST | `/api/billing/customer-portal` | Open Stripe billing portal |
| GET | `/api/billing/invoices` | Get billing/payment history |
| POST | `/api/webhooks/stripe` | Handle Stripe webhooks |

---

# 📊 Dashboard

| Method | Endpoint | Description |
|------|------|------|
| GET | `/api/dashboard/overview` | Get workspace dashboard summary |
| GET | `/api/dashboard/activity` | Get recent workspace activity |

---

# 📈 Analytics

| Method | Endpoint | Description |
|------|------|------|
| GET | `/api/analytics/projects` | Get project analytics |
| GET | `/api/analytics/revenue` | Get revenue analytics |

---

# ❤️ Health

| Method | Endpoint | Description |
|------|------|------|
| GET | `/api/health` | Check API server health status |
| GET | `/api/health/db` | Check database connectivity status |
| GET | `/api/health/ready` | Readiness probe for application |

---

# 🧾 Activity Logs

| Method | Endpoint | Description |
|------|------|------|
| GET | `/api/activity-logs` | Get workspace activity logs |
| GET | `/api/activity-logs/:logId` | Get specific activity log |

---

# 👤 Account

| Method | Endpoint | Description |
|------|------|------|
| GET | `/api/account/profile` | Get logged-in user profile |
| PATCH | `/api/account/profile` | Update profile |
| PATCH | `/api/account/password` | Update password |

---
## Golden Rule of Tenant Isolation

All queries must include:

```
WHERE workspace_id = currentWorkspace
```

This guarantees that no workspace can access another workspace’s data.


---

## Workspace Context Injection

Never trust workspaceId from client.

---

## Input Security

* Prevent SQL Injection
* Prevent XSS
* Validate all payloads

---

# 🚀 Future Enhancements

* Advanced analytics
* Workflow automation
* Email notifications
* Mobile app
* Plugin ecosystem
* Webhooks

---

# 📈 Conclusion

OpsCore is a **scalable multi-tenant SaaS platform** designed for real-world business operations.

Focus areas:

* Security
* Scalability
* Tenant isolation
* Clean modular architecture
