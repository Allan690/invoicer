import React, { useState, ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  FiHome,
  FiFileText,
  FiUsers,
  FiSettings,
  FiLogOut,
  FiMenu,
  FiX,
  FiPlus,
  FiChevronDown,
} from "react-icons/fi";

interface LayoutProps {
  children: ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavItemComponentProps {
  item: NavItem;
  mobile?: boolean;
}

export default function Layout({ children }: LayoutProps): React.JSX.Element {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = async (): Promise<void> => {
    await logout();
    navigate("/login");
  };

  const navigation: NavItem[] = [
    { name: "Dashboard", href: "/dashboard", icon: FiHome },
    { name: "Invoices", href: "/invoices", icon: FiFileText },
    { name: "Clients", href: "/clients", icon: FiUsers },
    { name: "Settings", href: "/settings", icon: FiSettings },
  ];

  const NavItemComponent = ({
    item,
    mobile = false,
  }: NavItemComponentProps): React.JSX.Element => (
    <NavLink
      to={item.href}
      onClick={() => mobile && setSidebarOpen(false)}
      className={({ isActive }) =>
        `${
          isActive
            ? "bg-primary-50 text-primary-700 border-r-2 border-primary-600"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        } group flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors duration-200`
      }
    >
      <item.icon className="h-5 w-5 flex-shrink-0" />
      {item.name}
    </NavLink>
  );

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden no-print"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out lg:hidden no-print ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <FiFileText className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Invoicer</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>
        <nav className="mt-4 space-y-1">
          {navigation.map((item) => (
            <NavItemComponent key={item.name} item={item} mobile />
          ))}
        </nav>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col no-print">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          {/* Logo */}
          <div className="flex items-center h-16 px-4 border-b border-gray-200">
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <FiFileText className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">Invoicer</span>
            </Link>
          </div>

          {/* Quick actions */}
          <div className="p-4">
            <Link
              to="/invoices/new"
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <FiPlus className="w-4 h-4" />
              New Invoice
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto">
            {navigation.map((item) => (
              <NavItemComponent key={item.name} item={item} />
            ))}
          </nav>

          {/* User info at bottom */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center gap-3">
              <div className="avatar avatar-md bg-primary-100 text-primary-700">
                {user?.fullName?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.fullName || "User"}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user?.email || ""}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="lg:pl-64 print:pl-0">
        {/* Top header */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm no-print">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 lg:hidden"
            >
              <FiMenu className="h-6 w-6" />
            </button>

            {/* Business name (desktop) */}
            <div className="hidden lg:block">
              <h1 className="text-lg font-semibold text-gray-900">
                {user?.businessName || user?.fullName || "My Business"}
              </h1>
            </div>

            {/* Mobile logo */}
            <div className="lg:hidden">
              <Link to="/dashboard" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <FiFileText className="w-5 h-5 text-white" />
                </div>
              </Link>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-4">
              {/* Quick create button (mobile) */}
              <Link
                to="/invoices/new"
                className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <FiPlus className="h-6 w-6" />
              </Link>

              {/* User dropdown */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="avatar avatar-sm bg-primary-100 text-primary-700">
                    {user?.fullName?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-gray-700">
                    {user?.fullName?.split(" ")[0] || "User"}
                  </span>
                  <FiChevronDown className="h-4 w-4 text-gray-400" />
                </button>

                {/* Dropdown menu */}
                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {user?.fullName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {user?.email}
                        </p>
                      </div>
                      <Link
                        to="/settings"
                        onClick={() => setUserMenuOpen(false)}
                        className="dropdown-item flex items-center gap-2"
                      >
                        <FiSettings className="h-4 w-4" />
                        Settings
                      </Link>
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          handleLogout();
                        }}
                        className="dropdown-item-danger flex items-center gap-2 w-full"
                      >
                        <FiLogOut className="h-4 w-4" />
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8 print:p-0">{children}</main>
      </div>
    </div>
  );
}
