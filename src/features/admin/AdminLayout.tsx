import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import Sidebar from "../../shared/Sidebar";

const AdminLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F5F1E8] text-[#2B2B2B] lg:flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1">
        <div className="flex items-center justify-between px-4 py-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E3DBCF] bg-white text-[#6B6B6B]"
            aria-label="Admin menyu"
          >
            <Menu size={18} />
          </button>
          <span className="text-sm font-semibold text-[#2B2B2B]">
            Admin Panel
          </span>
          <span className="h-10 w-10" />
        </div>
        <main className="px-4 py-6 lg:px-6 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;


