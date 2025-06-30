import { useState } from 'react';
import {
  CheckCircle,
  Users,
  BarChart3,
  Zap,
  Shield,
  Code,
  BookOpen,
  ArrowRight,
  Play,
  Server,
  TestTube,
  Monitor,
  Smartphone,
  Globe,
  Target,
  MessageSquare,
  Video,
  Building2,
  UserCheck,
  Activity,
  Database,
  Lock,
  Cloud,
  FileText,
  Settings,
  Layers,
  Github,
  Book,
  TrendingUp,
  Menu,
  X,
} from 'lucide-react';

function App() {
  const appVersion = import.meta.env.APP_VERSION || '1.0.0';

  const [activeTab, setActiveTab] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const features = [
    {
      icon: <CheckCircle className="w-6 h-6" />,
      title: 'Advanced Task Management',
      description:
        'Complete task lifecycle management with sprints, assignments, and progress tracking.',
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: 'Team & Organization Management',
      description:
        'Multi-level organization structure with departments, teams, and role-based permissions.',
    },
    {
      icon: <MessageSquare className="w-6 h-6" />,
      title: 'Real-time Chat & Collaboration',
      description:
        'Built-in chat system with WebSocket support for instant team communication.',
    },
    {
      icon: <Video className="w-6 h-6" />,
      title: 'Video Conferencing',
      description:
        'Integrated video conference capabilities for seamless remote collaboration.',
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: 'Activity Logging & Analytics',
      description:
        'Comprehensive activity tracking with detailed analytics and reporting.',
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: 'Enterprise Security',
      description:
        'Firebase authentication, JWT tokens, and granular permission system.',
    },
  ];

  const environments = [
    {
      name: 'Development',
      icon: <Code className="w-5 h-5" />,
      status: 'Active',
      url: 'dev-api.tasktrial.com',
      color: 'bg-blue-500',
      config: 'local.js',
    },
    {
      name: 'Production',
      icon: <Server className="w-5 h-5" />,
      status: 'Live',
      url: 'api.tasktrial.com',
      color: 'bg-green-500',
      config: 'prod.js',
    },
    {
      name: 'Testing',
      icon: <TestTube className="w-5 h-5" />,
      status: 'Running',
      url: 'test-api.tasktrial.com',
      color: 'bg-orange-500',
      config: 'testing.js',
    },
  ];

  const apiEndpoints = [
    {
      method: 'GET',
      endpoint: '/api/v1/projects',
      description: 'Retrieve all projects with pagination',
    },
    {
      method: 'POST',
      endpoint: '/api/v1/tasks',
      description: 'Create new task with sprint assignment',
    },
    {
      method: 'PUT',
      endpoint: '/api/v1/tasks/{id}',
      description: 'Update task status and assignments',
    },
    {
      method: 'GET',
      endpoint: '/api/v1/organizations',
      description: 'Get organization hierarchy',
    },
    {
      method: 'POST',
      endpoint: '/api/v1/chat/messages',
      description: 'Send real-time chat messages',
    },
    {
      method: 'GET',
      endpoint: '/api/v1/activity-logs',
      description: 'Retrieve activity logs and analytics',
    },
  ];

  const techStack = [
    {
      category: 'Backend',
      icon: <Server className="w-6 h-6" />,
      technologies: ['Node.js', 'Express.js', 'Prisma ORM', 'PostgreSQL'],
    },
    {
      category: 'Authentication',
      icon: <Lock className="w-6 h-6" />,
      technologies: [
        'Firebase Auth',
        'JWT Tokens',
        'Google OAuth',
        'Role-based Access',
      ],
    },
    {
      category: 'Real-time',
      icon: <Zap className="w-6 h-6" />,
      technologies: ['Socket.io', 'WebSocket', 'Redis Cache', 'Live Chat'],
    },
    {
      category: 'Storage & Media',
      icon: <Cloud className="w-6 h-6" />,
      technologies: ['Cloudinary', 'File Upload', 'Media Management', 'CDN'],
    },
    {
      category: 'Testing',
      icon: <TestTube className="w-6 h-6" />,
      technologies: ['Jest', 'E2E Testing', 'Integration Tests', 'Unit Tests'],
    },
    {
      category: 'DevOps',
      icon: <Settings className="w-6 h-6" />,
      technologies: [
        'Docker',
        'Multi-stage Build',
        'Environment Config',
        'API Limiting',
      ],
    },
  ];

  const coreModules = [
    {
      name: 'Authentication & Authorization',
      icon: <UserCheck className="w-5 h-5" />,
      description:
        'Complete auth system with Firebase, Google OAuth, and permission management',
      endpoints: 8,
    },
    {
      name: 'User Management',
      icon: <Users className="w-5 h-5" />,
      description:
        'Complete user lifecycle management with profiles and permissions',
      endpoints: 10,
    },
    {
      name: 'Organization Management',
      icon: <Building2 className="w-5 h-5" />,
      description:
        'Multi-level organization structure with departments and teams',
      endpoints: 12,
    },
    {
      name: 'Department Management',
      icon: <Layers className="w-5 h-5" />,
      description:
        'Create and manage departments with specialized roles and functions',
      endpoints: 6,
    },
    {
      name: 'Team Management',
      icon: <Users className="w-5 h-5" />,
      description:
        'Form cross-functional teams with members from different departments',
      endpoints: 8,
    },
    {
      name: 'Project Management',
      icon: <Target className="w-5 h-5" />,
      description:
        'Create and track projects with goals, timelines, and resource allocation',
      endpoints: 14,
    },
    {
      name: 'Sprint & Task Management',
      icon: <CheckCircle className="w-5 h-5" />,
      description:
        'Plan work iterations with sprints and manage tasks with assignments and progress tracking',
      endpoints: 24,
    },
    {
      name: 'Real-time Communication',
      icon: <MessageSquare className="w-5 h-5" />,
      description: 'Chat system with WebSocket support and video conferencing',
      endpoints: 16,
    },
    {
      name: 'Activity & Analytics',
      icon: <Activity className="w-5 h-5" />,
      description:
        'Comprehensive logging and analytics for all user activities',
      endpoints: 6,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/10 backdrop-blur-md border-b border-white/20 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-teal-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">&lt;/&gt;</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold text-white">TaskTrial</span>
                <span className="text-xs text-white/60 bg-white/10 px-2 py-1 rounded-full">
                  v{appVersion}
                </span>
              </div>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden text-white focus:outline-none"
              onClick={toggleMobileMenu}
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <a
                href="#features"
                className="text-white/80 hover:text-white transition-colors"
              >
                Features
              </a>
              <a
                href="#api"
                className="text-white/80 hover:text-white transition-colors"
              >
                API
              </a>
              <a
                href="#architecture"
                className="text-white/80 hover:text-white transition-colors"
              >
                Architecture
              </a>
              <a
                href="#environments"
                className="text-white/80 hover:text-white transition-colors"
              >
                Environments
              </a>
              <a
                href="https://tasktrial-prod.vercel.app/api-docs"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Documentation
              </a>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900/95 backdrop-blur-md border-b border-white/10 animate-fade-in-down">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <a
                href="#features"
                className="block px-3 py-2 text-white hover:bg-white/10 rounded-md text-base font-medium transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </a>
              <a
                href="#api"
                className="block px-3 py-2 text-white hover:bg-white/10 rounded-md text-base font-medium transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                API
              </a>
              <a
                href="#architecture"
                className="block px-3 py-2 text-white hover:bg-white/10 rounded-md text-base font-medium transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Architecture
              </a>
              <a
                href="#environments"
                className="block px-3 py-2 text-white hover:bg-white/10 rounded-md text-base font-medium transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Environments
              </a>
              <a
                href="https://tasktrial-prod.vercel.app/api-docs"
                className="block px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-base font-medium transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Documentation
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="mb-8">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Enterprise-Grade
              <span className="bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
                {' '}
                Project
              </span>{' '}
              Management API
            </h1>
            <p className="text-xl md:text-2xl text-white/80 mb-8 max-w-4xl mx-auto">
              TaskTrial delivers a comprehensive project management platform
              with real-time collaboration, advanced analytics, and enterprise
              security. Built with Node.js, Prisma, and modern web technologies.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <a
              href="https://tasktrial-prod.vercel.app/api-docs"
              className="bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all transform hover:scale-105 flex items-center space-x-2"
            >
              <BookOpen className="w-5 h-5" />
              <span>API Documentation</span>
              <ArrowRight className="w-5 h-5" />
            </a>
            <button className="border-2 border-white/30 hover:border-white/50 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:bg-white/10 flex items-center space-x-2">
              <Play className="w-5 h-5" />
              <span>Live Demo</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto p-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-white mb-2">76+</div>
              <div className="text-white/60">API Endpoints</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-white mb-2">9</div>
              <div className="text-white/60">Core Modules</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-white mb-2">3</div>
              <div className="text-white/60">Environments</div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Modules Section */}
      <section id="modules" className="py-16 px-4 sm:px-6 lg:px-8 bg-black/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Core API Modules
            </h2>
            <p className="text-xl text-white/70 max-w-3xl mx-auto">
              Comprehensive modules covering every aspect of project management
              and team collaboration.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {coreModules.map((module, index) => (
              <div
                key={index}
                className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-300 transform hover:scale-105"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-teal-500 rounded-xl flex items-center justify-center text-white">
                    {module.icon}
                  </div>
                  <span className="text-sm text-blue-300 bg-blue-500/20 px-3 py-1 rounded-full">
                    {module.endpoints} endpoints
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  {module.name}
                </h3>
                <p className="text-white/70">{module.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Enterprise Features
            </h2>
            <p className="text-xl text-white/70 max-w-3xl mx-auto">
              Built for scale with enterprise-grade security, real-time
              capabilities, and comprehensive testing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-300 transform hover:scale-105"
              >
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-teal-500 rounded-xl flex items-center justify-center mb-4 text-white">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-white/70">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Technology Stack */}
      <section
        id="architecture"
        className="py-16 px-4 sm:px-6 lg:px-8 bg-black/20"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Modern Technology Stack
            </h2>
            <p className="text-xl text-white/70 max-w-3xl mx-auto">
              Built with cutting-edge technologies for performance, scalability,
              and maintainability.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {techStack.map((stack, index) => (
              <div
                key={index}
                className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all"
              >
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-teal-500 rounded-lg flex items-center justify-center text-white">
                    {stack.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-white">
                    {stack.category}
                  </h3>
                </div>
                <div className="space-y-2">
                  {stack.technologies.map((tech, techIndex) => (
                    <div
                      key={techIndex}
                      className="text-white/70 text-sm bg-white/5 px-3 py-1 rounded-lg"
                    >
                      {tech}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* API Section */}
      <section id="api" className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              RESTful API Endpoints
            </h2>
            <p className="text-xl text-white/70 max-w-3xl mx-auto">
              Comprehensive API with Swagger documentation, validation, and
              comprehensive testing coverage.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    Sample API Endpoints
                  </h3>
                  <span className="text-sm text-green-400 bg-green-400/20 px-3 py-1 rounded-full">
                    v1.0
                  </span>
                </div>
                <div className="space-y-3">
                  {apiEndpoints.map((endpoint, index) => (
                    <div
                      key={index}
                      className="flex items-start space-x-3 p-3 bg-white/5 rounded-lg"
                    >
                      <span
                        className={`text-xs font-mono px-2 py-1 rounded flex-shrink-0 ${
                          endpoint.method === 'GET'
                            ? 'bg-blue-500/20 text-blue-300'
                            : endpoint.method === 'POST'
                              ? 'bg-green-500/20 text-green-300'
                              : 'bg-orange-500/20 text-orange-300'
                        }`}
                      >
                        {endpoint.method}
                      </span>
                      <div className="flex-1 min-w-0">
                        <code className="text-white/80 font-mono text-sm block">
                          {endpoint.endpoint}
                        </code>
                        <p className="text-white/60 text-xs mt-1">
                          {endpoint.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                <FileText className="w-8 h-8 text-blue-400 mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">
                  Swagger Documentation
                </h3>
                <p className="text-white/70">
                  Complete API documentation with interactive testing
                  capabilities.
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                <Shield className="w-8 h-8 text-green-400 mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">
                  Request Validation
                </h3>
                <p className="text-white/70">
                  Comprehensive input validation with detailed error responses.
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                <TestTube className="w-8 h-8 text-purple-400 mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">
                  Testing Coverage
                </h3>
                <p className="text-white/70">
                  Unit, integration, and E2E tests with comprehensive coverage.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Environments Section */}
      <section
        id="environments"
        className="py-16 px-4 sm:px-6 lg:px-8 bg-black/20"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Multi-Stage Docker Deployment
            </h2>
            <p className="text-xl text-white/70 max-w-3xl mx-auto">
              Optimized Docker containers with environment-specific
              configurations for development, testing, and production.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {environments.map((env, index) => (
              <div
                key={index}
                className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center text-white">
                      {env.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {env.name}
                      </h3>
                      <p className="text-sm text-white/60">{env.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${env.color}`}></div>
                    <span className="text-sm text-white/80">{env.status}</span>
                  </div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3 mb-3">
                  <code className="text-xs text-green-400 font-mono">
                    docker-compose up --build {env.name.toLowerCase()}
                  </code>
                </div>
                <div className="text-xs text-white/60">
                  Config: <span className="text-blue-300">{env.config}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Availability */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-8">
            Multi-Platform Availability
          </h2>
          <p className="text-xl text-white/70 mb-12 max-w-3xl mx-auto">
            Access TaskTrial from any device with our responsive web application
            and native mobile apps built with Flutter.
          </p>

          <div className="flex justify-center items-center space-x-12">
            <div className="text-center">
              <Monitor className="w-16 h-16 text-blue-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white">
                Web Application
              </h3>
              <p className="text-white/60">Full-featured dashboard</p>
            </div>
            <div className="text-center">
              <Smartphone className="w-16 h-16 text-teal-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white">Mobile Apps</h3>
              <p className="text-white/60">iOS & Android (Flutter)</p>
            </div>
            <div className="text-center">
              <Globe className="w-16 h-16 text-purple-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white">API Access</h3>
              <p className="text-white/60">RESTful & WebSocket</p>
            </div>
          </div>
        </div>
      </section>

      {/* Technology Stack */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Built with Modern Technology
            </h2>
            <p className="text-xl text-white/70">
              Reliable, scalable, and secure infrastructure
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { icon: Server, name: 'Node.js', desc: 'Runtime' },
              { icon: Database, name: 'Prisma', desc: 'Database ORM' },
              { icon: Lock, name: 'JWT Auth', desc: 'Security' },
              { icon: Globe, name: 'Socket.IO', desc: 'Real-time' },
              { icon: Smartphone, name: 'Firebase', desc: 'Mobile Support' },
              { icon: Shield, name: 'Redis', desc: 'Caching' },
              { icon: Zap, name: 'Express', desc: 'Web Framework' },
              { icon: TrendingUp, name: 'Cloudinary', desc: 'Media Storage' },
            ].map((tech, index) => {
              const TechIcon = tech.icon;
              return (
                <div key={index} className="text-center group">
                  <div className="bg-white/10 w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:bg-white/20 transition-all">
                    <TechIcon className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-white font-semibold">{tech.name}</div>
                  <div className="text-white/60 text-sm">{tech.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600/20 to-purple-600/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Build Something Amazing?
          </h2>
          <p className="text-xl text-white/80 mb-8 leading-relaxed">
            Get started with TaskTrial API today and transform how your team
            manages projects. Comprehensive documentation and examples included.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://tasktrial-prod.vercel.app/api-docs"
              className="bg-white text-gray-900 hover:bg-gray-100 px-8 py-4 rounded-lg font-semibold transition-all flex items-center space-x-2"
            >
              <Book className="w-5 h-5" />
              <span>View API Documentation</span>
            </a>
            <a
              href="https://github.com/TaskTrial/server"
              className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-gray-900 px-8 py-4 rounded-lg font-semibold transition-all flex items-center space-x-2"
            >
              <Github className="w-5 h-5" />
              <span>View on GitHub</span>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t border-white/20">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-teal-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">&lt;/&gt;</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-bold text-white">TaskTrial</span>
              <span className="text-xs text-white/60 bg-white/10 px-2 py-1 rounded-full">
                v{appVersion}
              </span>
            </div>
          </div>
          <p className="text-white/60 mb-4">
            Enterprise-grade project management API platform for modern
            development teams.
          </p>
          <p className="text-white/40 text-sm">
            &copy; 2024 TaskTrial. All rights reserved. Built with Node.js,
            Prisma, and modern web technologies.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
