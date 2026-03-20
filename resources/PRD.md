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

# 🔐 Authentication (Better Auth)

> These routes are handled by Better Auth (Google login, session, etc.)

| Method | Endpoint | Description |
|------|------|------|
| ALL | `/api/auth/*` | Better Auth handler (login, OAuth, session, etc.) |

---

# 🔐 Authentication (Custom Logic)

| Method | Endpoint | Description |
|------|------|------|
| POST | `/api/v1/auth/register` | Register user and create workspace |
| POST | `/api/v1/auth/login` | Login user |
| POST | `/api/v1/auth/logout` | Logout user |
| GET | `/api/v1/auth/me` | Get authenticated user |
| POST | `/api/v1/auth/forgot-password` | Send password reset link |
| POST | `/api/v1/auth/reset-password` | Reset password |
| POST | `/api/v1/auth/change-password` | Change password (legacy/compatibility) |
| POST | `/api/v1/auth/verify-email` | Verify user email |
| POST | `/api/v1/auth/resend-verification` | Resend verification email |
| PATCH | `/api/v1/auth/workspace/switch` | Switch active workspace (internal route) |

---

# 🏢 Workspaces

| Method | Endpoint | Description |
|------|------|------|
| GET | `/api/v1/workspaces` | Get all workspaces of authenticated user |
| POST | `/api/v1/workspaces` | Create a new workspace |
| GET | `/api/v1/workspaces/:workspaceId` | Get single workspace details |
| PATCH | `/api/v1/workspaces/:workspaceId` | Update workspace settings |
| DELETE | `/api/v1/workspaces/:workspaceId` | Delete workspace (Owner only) |
| POST | `/api/v1/workspaces/:workspaceId/switch` | Switch active workspace |

---

# 👥 Workspace Members

| Method | Endpoint | Description |
|------|------|------|
| GET | `/api/v1/workspaces/:workspaceId/members` | Get all members of a workspace |
| PATCH | `/api/v1/workspaces/:workspaceId/members/:memberId` | Update member role/status |
| DELETE | `/api/v1/workspaces/:workspaceId/members/:memberId` | Remove member from workspace |

---

# ✉️ Invitations

| Method | Endpoint | Description |
|------|------|------|
| GET | `/api/v1/workspaces/:workspaceId/invitations` | Get all workspace invitations |
| POST | `/api/v1/workspaces/:workspaceId/invitations` | Invite a user to workspace |
| DELETE | `/api/v1/workspaces/:workspaceId/invitations/:invitationId` | Cancel invitation |
| POST | `/api/v1/invitations/:token/accept` | Accept workspace invitation |
| POST | `/api/v1/invitations/:token/decline` | Decline workspace invitation |

---

# 📁 Projects

| Method | Endpoint | Description |
|------|------|------|
| GET | `/api/v1/projects` | Get all projects in active workspace |
| POST | `/api/v1/projects` | Create a project |
| GET | `/api/v1/projects/:projectId` | Get single project details |
| PATCH | `/api/v1/projects/:projectId` | Update project |
| DELETE | `/api/v1/projects/:projectId` | Delete project |

### Nested Project Routes

| Method | Endpoint | Description |
|------|------|------|
| GET | `/api/v1/projects/:projectId/tasks` | Get tasks of a specific project |
| GET | `/api/v1/projects/:projectId/members` | Get project members |
| POST | `/api/v1/projects/:projectId/members` | Assign members to project |

---

# ✅ Tasks

| Method | Endpoint | Description |
|------|------|------|
| GET | `/api/v1/tasks` | Get all tasks in active workspace |
| POST | `/api/v1/tasks` | Create a task |
| GET | `/api/v1/tasks/:taskId` | Get single task details |
| PATCH | `/api/v1/tasks/:taskId` | Update task |
| DELETE | `/api/v1/tasks/:taskId` | Delete task |

### Task Extensions

| Method | Endpoint | Description |
|------|------|------|
| GET | `/api/v1/tasks/:taskId/comments` | Get task comments |
| POST | `/api/v1/tasks/:taskId/comments` | Add comment to task |
| PATCH | `/api/v1/tasks/:taskId/comments/:commentId` | Update comment |
| DELETE | `/api/v1/tasks/:taskId/comments/:commentId` | Delete comment |
| GET | `/api/v1/tasks/:taskId/attachments` | Get task attachments |
| POST | `/api/v1/tasks/:taskId/attachments` | Upload task attachment |
| DELETE | `/api/v1/tasks/:taskId/attachments/:attachmentId` | Delete attachment |

---

# 💳 Invoices

| Method | Endpoint | Description |
|------|------|------|
| GET | `/api/v1/invoices` | Get all invoices in active workspace |
| POST | `/api/v1/invoices` | Create invoice |
| GET | `/api/v1/invoices/:invoiceId` | Get invoice details |
| PATCH | `/api/v1/invoices/:invoiceId` | Update invoice |
| DELETE | `/api/v1/invoices/:invoiceId` | Delete or archive invoice |
| POST | `/api/v1/invoices/:invoiceId/send` | Send invoice |
| POST | `/api/v1/invoices/:invoiceId/mark-paid` | Mark invoice as paid |
| POST | `/api/v1/invoices/:invoiceId/cancel` | Cancel invoice |

---

# 💰 Billing & Subscription

| Method | Endpoint | Description |
|------|------|------|
| GET | `/api/v1/billing/subscription` | Get current workspace subscription |
| POST | `/api/v1/billing/checkout-session` | Create Stripe checkout session |
| POST | `/api/v1/billing/customer-portal` | Open Stripe billing portal |
| GET | `/api/v1/billing/invoices` | Get billing/payment history |
| POST | `/api/v1/webhooks/stripe` | Handle Stripe webhooks |

---

# 📊 Dashboard

| Method | Endpoint | Description |
|------|------|------|
| GET | `/api/v1/dashboard/overview` | Get workspace dashboard summary |
| GET | `/api/v1/dashboard/activity` | Get recent workspace activity |

---

# 📈 Analytics

| Method | Endpoint | Description |
|------|------|------|
| GET | `/api/v1/analytics/projects` | Get project analytics |
| GET | `/api/v1/analytics/revenue` | Get revenue analytics |

---

# ❤️ Health

| Method | Endpoint | Description |
|------|------|------|
| GET | `/api/v1/health` | Check API server health status |
| GET | `/api/v1/health/db` | Check database connectivity status |
| GET | `/api/v1/health/ready` | Readiness probe for application |

---

# 🧾 Activity Logs

| Method | Endpoint | Description |
|------|------|------|
| GET | `/api/v1/activity-logs` | Get workspace activity logs |
| GET | `/api/v1/activity-logs/:logId` | Get specific activity log |

---

# 👤 Account

| Method | Endpoint | Description |
|------|------|------|
| GET | `/api/v1/account/profile` | Get logged-in user profile |
| PATCH | `/api/v1/account/profile` | Update profile |
| PATCH | `/api/v1/account/password` | Update password (primary route) |

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
