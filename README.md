# Invoicer - Freelance Invoicing Application

A full-stack invoicing application built for freelancers, featuring React + Vite frontend, Express.js backend, and PostgreSQL database, all containerized with Docker.

![Invoicer Screenshot](https://via.placeholder.com/800x400?text=Invoicer+Dashboard)

## Features

- 📊 **Dashboard** - Overview of revenue, outstanding invoices, and key metrics
- 📄 **Invoice Management** - Create, edit, duplicate, and track invoices
- 👥 **Client Management** - Maintain a directory of clients with contact details
- 💰 **Payment Tracking** - Record partial or full payments against invoices
- 📈 **Status Tracking** - Track invoice status (draft, sent, viewed, paid, overdue)
- 🎨 **Professional Templates** - Clean, customizable invoice design
- 💱 **Multi-Currency Support** - Support for GBP, USD, EUR, KES, and more
- 🔒 **Authentication** - Secure JWT-based authentication
- 🐳 **Dockerized** - Easy deployment with Docker Compose

## Tech Stack

### Frontend
- **React 18** - UI library
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Client-side routing
- **TanStack Query** - Data fetching and caching
- **Axios** - HTTP client
- **React Hot Toast** - Notifications
- **React Icons** - Icon library
- **date-fns** - Date formatting

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **PostgreSQL** - Database
- **JWT** - Authentication
- **bcrypt** - Password hashing
- **express-validator** - Input validation

### DevOps
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration

## Quick Start

### Prerequisites

- Docker and Docker Compose installed on your machine
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd invoicer
   ```

2. **Start the application**
   ```bash
   docker-compose up --build
   ```

3. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - Database: localhost:5432

4. **Create an account**
   - Navigate to http://localhost:5173/register
   - Fill in your details and start creating invoices!

### Development Mode

For development with hot-reloading:

```bash
# Start all services
docker-compose up

# Or start services individually
docker-compose up db          # Start only database
docker-compose up backend     # Start only backend
docker-compose up frontend    # Start only frontend
```

### Stopping the Application

```bash
# Stop all containers
docker-compose down

# Stop and remove volumes (clears database)
docker-compose down -v
```

## Project Structure

```
invoicer/
├── docker-compose.yml        # Docker Compose configuration
├── frontend/                 # React frontend
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx          # Entry point
│       ├── App.jsx           # Main app component
│       ├── index.css         # Global styles
│       ├── components/       # Reusable components
│       │   └── Layout.jsx
│       ├── pages/            # Page components
│       │   ├── Dashboard.jsx
│       │   ├── Invoices.jsx
│       │   ├── InvoiceDetail.jsx
│       │   ├── InvoiceForm.jsx
│       │   ├── Clients.jsx
│       │   ├── ClientDetail.jsx
│       │   ├── ClientForm.jsx
│       │   ├── Settings.jsx
│       │   ├── Login.jsx
│       │   └── Register.jsx
│       ├── context/          # React context
│       │   └── AuthContext.jsx
│       └── services/         # API services
│           └── api.js
└── backend/                  # Express backend
    ├── Dockerfile
    ├── package.json
    ├── db/
    │   └── init.sql          # Database schema
    └── src/
        ├── index.js          # Entry point
        ├── db/
        │   └── index.js      # Database connection
        ├── middleware/
        │   ├── auth.js       # Authentication middleware
        │   └── errorHandler.js
        └── routes/
            ├── auth.js       # Authentication routes
            ├── clients.js    # Client CRUD routes
            ├── invoices.js   # Invoice CRUD routes
            ├── dashboard.js  # Dashboard stats routes
            └── settings.js   # User settings routes
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user

### Clients
- `GET /api/clients` - List all clients
- `GET /api/clients/:id` - Get client details
- `POST /api/clients` - Create a client
- `PUT /api/clients/:id` - Update a client
- `DELETE /api/clients/:id` - Delete a client
- `GET /api/clients/:id/invoices` - Get client's invoices

### Invoices
- `GET /api/invoices` - List all invoices
- `GET /api/invoices/:id` - Get invoice details
- `POST /api/invoices` - Create an invoice
- `PUT /api/invoices/:id` - Update an invoice
- `DELETE /api/invoices/:id` - Delete an invoice
- `PATCH /api/invoices/:id/status` - Update invoice status
- `POST /api/invoices/:id/duplicate` - Duplicate an invoice
- `POST /api/invoices/:id/payments` - Add a payment
- `DELETE /api/invoices/:id/payments/:paymentId` - Delete a payment

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/revenue/monthly` - Get monthly revenue data
- `GET /api/dashboard/clients/top` - Get top clients
- `GET /api/dashboard/invoices/due-soon` - Get invoices due soon
- `GET /api/dashboard/invoices/overdue` - Get overdue invoices

### Settings
- `GET /api/settings/profile` - Get user profile
- `PUT /api/settings/profile` - Update profile
- `PUT /api/settings/password` - Change password
- `GET /api/settings/invoice` - Get invoice settings
- `PUT /api/settings/invoice` - Update invoice settings

## Environment Variables

### Backend
| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `JWT_SECRET` | Secret for JWT tokens | - |
| `NODE_ENV` | Environment mode | `development` |

### Frontend
| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `/api` |

## Database Schema

The application uses the following main tables:

- **users** - User accounts and business details
- **clients** - Client directory
- **invoices** - Invoice records
- **invoice_items** - Line items for invoices
- **payments** - Payment records
- **invoice_templates** - Invoice customization
- **invoice_sequences** - Auto-incrementing invoice numbers
- **expenses** - Business expenses (optional feature)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

If you have any questions or need help, please open an issue on GitHub.

---

Built with ❤️ for freelancers everywhere
