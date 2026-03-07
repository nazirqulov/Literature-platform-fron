import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './shared/components/Navbar';
import AuthLayout from './features/auth/AuthLayout';
import RegisterPage from './features/auth/RegisterPage';
import VerifyEmailPage from './features/auth/VerifyEmailPage';
import LoginPage from './features/auth/LoginPage';
import GuestDashboard from './features/dashboard/GuestDashboard';
import UserDashboard from './features/dashboard/UserDashboard';
import ProfilePage from './features/profile/ProfilePage';
import FavoriteBooksPage from './features/profile/FavoriteBooksPage';
import CompletedBooksPage from './features/profile/CompletedBooksPage';
import ReadingBooksPage from './features/profile/ReadingBooksPage';
import AdminLayout from './features/admin/AdminLayout';
import AdminDashboardPage from './features/admin/AdminDashboardPage';
import AdminBooksPage from './features/admin/AdminBooksPage';
import AdminUsersPage from './features/admin/AdminUsersPage';
import AdminAuthorsPage from './features/admin/AdminAuthorsPage';
import AdminCategoriesPage from './features/admin/AdminCategoriesPage';
import BooksPage from './features/books/BooksPage';
import BookReaderPage from './features/books/BookReaderPage';
import BookDetailPage from './features/books/BookDetailPage';
import BookAudioPage from './features/books/BookAudioPage';
import SizUchunPage from './features/books/SizUchunPage';
import TopKitoblarPage from './features/books/TopKitoblarPage';
import AuthorsPage from './features/authors/AuthorsPage';
import AuthorDetailPage from './features/authors/AuthorDetailPage';
import ProtectedRoute from './shared/components/ProtectedRoute';
import AdminRoute from './shared/components/AdminRoute';
import { useAuth } from './context/useAuth';
import { useTheme } from './context/useTheme';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const App: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { theme } = useTheme();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F1E8]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#6B4F3A]"></div>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main>
        <Routes>
          <Route
            path="/"
            element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <GuestDashboard />}
          />

          <Route element={<AuthLayout />}>
            <Route
              path="/register"
              element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterPage />}
            />
            <Route
              path="/verify-email"
              element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <VerifyEmailPage />}
            />
            <Route
              path="/login"
              element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />}
            />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<UserDashboard />} />
            <Route path="/books" element={<BooksPage />} />
            <Route path="/books/:bookId" element={<BookDetailPage />} />
            <Route path="/books/:bookId/read" element={<BookReaderPage />} />
            <Route path="/books/:bookId/audio" element={<BookAudioPage />} />
            <Route path="/books/siz-uchun" element={<SizUchunPage />} />
            <Route path="/books/top-kitoblar" element={<TopKitoblarPage />} />
            <Route path="/authors" element={<AuthorsPage />} />
            <Route path="/authors/:authorId" element={<AuthorDetailPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/favorites" element={<FavoriteBooksPage />} />
            <Route path="/profile/completed" element={<CompletedBooksPage />} />
            <Route path="/profile/reading" element={<ReadingBooksPage />} />
          </Route>

          <Route element={<AdminRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/books" element={<AdminBooksPage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/profile" element={<ProfilePage />} />
              <Route path="/admin/authors" element={<AdminAuthorsPage />} />
              <Route path="/admin/categories" element={<AdminCategoriesPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <ToastContainer
        position="bottom-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme={theme === 'dark' ? 'dark' : 'light'}
      />
    </>
  );
};

export default App;



