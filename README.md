# Zishu-sensei 🌳

An intelligent AI teaching assistant platform powered by advanced language models.

## 🌟 Features

- **Multi-Model AI Integration**: OpenAI GPT, Anthropic Claude support
- **Adaptive Learning**: Personalized teaching approaches
- **Multi-Subject Support**: Mathematics, Science, Language Arts, and more
- **Interactive Learning**: Real-time conversations with context
- **Progress Tracking**: Comprehensive analytics and monitoring

## 🚀 Quick Start

### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+
- 4GB+ RAM

### Installation

```bash
# Clone repository
git clone https://github.com/your-org/Zishu-sensei.git
cd Zishu-sensei

# Setup environment
cp docker/env.template docker/.env
# Edit docker/.env with your API keys

# Start platform
make dev
```

### Access Points
- **API**: http://localhost:8000
- **Docs**: http://localhost:8000/docs
- **Jupyter**: http://localhost:8888

## 🛠️ Development

```bash
# Development commands
make dev          # Quick start
make dev-api      # Run API server
make test         # Run tests
make lint         # Code linting

# Database
make db-migrate   # Run migrations
make db-reset     # Reset database

# Docker
make build        # Build images
make start        # Start services
make health       # Health checks
```

## 📊 Architecture

```
Web/Mobile Clients
       ↓
   API Gateway (FastAPI + Nginx)
       ↓
   Core Services
   ├── Teaching Engine
   ├── User Management
   ├── Analytics Engine
   └── Assessment Tools
       ↓
   AI Integration Layer
   ├── OpenAI GPT
   ├── Anthropic Claude
   └── Custom Models
       ↓
   Data Layer
   ├── PostgreSQL
   └── Redis
```

## 🔧 Configuration

Key environment variables in `docker/.env`:

```bash
# AI Models
OPENAI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key

# Database
POSTGRES_PASSWORD=your-password
REDIS_PASSWORD=your-password

# Security
JWT_SECRET=your-jwt-secret
ZISHU_SECRET_KEY=your-secret
```

## 📝 Documentation

- [Deployment Guide](DEPLOYMENT.md)
- [API Docs](http://localhost:8000/docs)
- [Architecture](docs/architecture.md)
- [Development](docs/development.md)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Run tests: `make check`
5. Submit pull request

## 📞 Support

- **Issues**: GitHub Issues
- **Docs**: [docs/](docs/)
- **Email**: support@zishu-sensei.com

## 📄 License

MIT License - see [LICENSE](LICENSE) file.

---

**Zishu-sensei** - Empowering education through AI 🌳📚