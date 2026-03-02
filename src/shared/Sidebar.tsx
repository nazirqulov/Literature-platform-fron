import React, { memo } from "react";
import { Link, useLocation } from "react-router-dom";
import { BookOpen, Users, UserPen, User, Tags, X } from "lucide-react";
import { useAuth } from "../context/useAuth";

type SidebarItemProps = {
  to: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
};

const SidebarItem: React.FC<SidebarItemProps> = ({
  to,
  label,
  icon,
  isActive,
}) => {
  return (
    <Link
      to={to}
      className={[
        "flex items-center gap-3 rounded-lg px-4 py-2.5 text-base font-semibold transition-colors",
        isActive
          ? "bg-[#6B4F3A] text-[#F5F1E8] shadow-sm"
          : "text-[#6B6B6B] hover:bg-[#EFE7DB] hover:text-[#2B2B2B]",
      ].join(" ")}
      aria-current={isActive ? "page" : undefined}
    >
      <span className="text-xl">{icon}</span>
      <span>{label}</span>
    </Link>
  );
};

type SidebarProps = {
  isOpen?: boolean;
  onClose?: () => void;
};

const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const { user } = useAuth();
  const location = useLocation();

  const role = user?.role;
  const isSuperAdmin = role === "SUPERADMIN" || role === "ROLE_SUPERADMIN";

  if (!user || !isSuperAdmin) {
    return null;
  }

  const items = [
    { to: "/admin/books", label: "Kitoblar", icon: <BookOpen size={20} /> },
    { to: "/admin/users", label: "Foydalanuvchilar", icon: <Users size={20} /> },
    { to: "/admin/profile", label: "Profil", icon: <User size={20} /> },
    { to: "/admin/categories", label: "Categoryni boshqarish", icon: <Tags size={20} /> },
    { to: "/admin/authors", label: "Autorlar", icon: <UserPen size={20} /> },
  ];

  return (
    <>
      <aside className="hidden h-screen w-72 border-r border-[#E3DBCF] bg-white text-[#2B2B2B] lg:sticky lg:top-0 lg:block">
        <nav className="flex h-full flex-col gap-4 px-4 py-6">
          <div className="space-y-1">
            {items.map((item) => {
              const isActive = location.pathname.startsWith(item.to);
              return (
                <SidebarItem
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  icon={item.icon}
                  isActive={isActive}
                />
              );
            })}
          </div>
        </nav>
      </aside>

      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            onClick={onClose}
            className="absolute inset-0 bg-black/40"
            aria-label="Sidebarni yopish"
          />
          <aside className="absolute left-0 top-0 h-full w-72 border-r border-[#E3DBCF] bg-white text-[#2B2B2B] shadow-2xl">
            <nav className="flex h-full flex-col gap-4 px-4 py-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#2B2B2B]">
                  Admin menyu
                </span>
                <button
                  onClick={onClose}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E3DBCF] text-[#6B6B6B]"
                  aria-label="Sidebarni yopish"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-1">
                {items.map((item) => {
                  const isActive = location.pathname.startsWith(item.to);
                  return (
                    <SidebarItem
                      key={item.to}
                      to={item.to}
                      label={item.label}
                      icon={item.icon}
                      isActive={isActive}
                    />
                  );
                })}
              </div>
            </nav>
          </aside>
        </div>
      )}
    </>
  );
};

export default memo(Sidebar);


