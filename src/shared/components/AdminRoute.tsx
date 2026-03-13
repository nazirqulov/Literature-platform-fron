import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { isSuperAdminRole } from "../utils/roleUtils";

interface AdminRouteProps {
  redirectPath?: string;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ redirectPath = "/dashboard" }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F1E8]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#6B4F3A]"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const isSuperAdmin = isSuperAdminRole(user?.role);

  if (!user || !isSuperAdmin) {
    return <Navigate to={redirectPath} replace />;
  }

  return <Outlet />;
};

export default AdminRoute;


