import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import SiteHeader from "./components/SiteHeader";
import SiteFooter from "./components/SiteFooter";
import ContentProvider from "./data/ContentProvider";
import HomePage from "./pages/HomePage";
import TopicsPage from "./pages/TopicsPage";
import ModuleDetailPage from "./pages/ModuleDetailPage";
import AboutPage from "./pages/AboutPage";
import NotFoundPage from "./pages/NotFoundPage";
import ProtectedRoute from "./auth/ProtectedRoute";
import AuthLayout from "./layouts/AuthLayout";
import LoginPage from "./auth/pages/LoginPage";
import RegisterPage from "./auth/pages/RegisterPage";
import ForgotPasswordPage from "./auth/pages/ForgotPasswordPage";
import PendingApprovalPage from "./auth/pages/PendingApprovalPage";
import Placeholder from "./auth/pages/Placeholder";
import FacultyDashboard from "./pages/faculty/Dashboard";
import SubjectNew from "./pages/faculty/SubjectNew";
import SubjectSettings from "./pages/faculty/SubjectSettings";
import Roster from "./pages/faculty/Roster";
import Report from "./pages/faculty/Report";
import FacultyTopics from "./pages/faculty/Topics";
import TopicEditor from "./pages/faculty/TopicEditor";
import QuizBuilder from './pages/faculty/QuizBuilder';
import GradingQueue from "./pages/faculty/GradingQueue";
import StudentScores from "./pages/faculty/StudentScores";

import StudentDashboard from "./pages/student/Dashboard";
import JoinSubject from "./pages/student/JoinSubject";
import SubjectTopics from "./pages/student/SubjectTopics";
import QuizRun from './pages/student/QuizRun';
import Grades from "./pages/student/Grades";

import TopicView from "./pages/student/TopicView";
import UsersPage from "./pages/admin/Users";

export default function App() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const target = document.getElementById(location.hash.slice(1));
      if (target) {
        window.requestAnimationFrame(() => {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.pathname, location.hash]);

  return (
    <ContentProvider>
      <div className="site" id="top">
        <a href="#content" className="skip-link">
          Skip to content
        </a>
        <SiteHeader />
        <main id="content" tabIndex="-1">
          <Routes>
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/pending-approval" element={<PendingApprovalPage />} />
            </Route>

            <Route path="/" element={<HomePage />} />
            <Route path="/topics" element={<TopicsPage />} />
            <Route path="/topics/:id" element={<ModuleDetailPage />} />
            <Route path="/about" element={<AboutPage />} />

            <Route path="/student/topics/:id/quiz" element={<ProtectedRoute roles={["student"]}><QuizRun /></ProtectedRoute>} />

            <Route path="/student" element={<ProtectedRoute roles={["student"]}><StudentDashboard /></ProtectedRoute>} />
            <Route path="/student/join" element={<ProtectedRoute roles={["student"]}><JoinSubject /></ProtectedRoute>} />
            <Route path="/student/subjects/:id" element={<ProtectedRoute roles={["student"]}><SubjectTopics /></ProtectedRoute>} />
            <Route path="/student/topics/:id" element={<ProtectedRoute roles={["student"]}><TopicView /></ProtectedRoute>} />
            <Route path="/student/subjects/:id/grades" element={<ProtectedRoute roles={["student"]}><Grades /></ProtectedRoute>} />

            <Route path="/faculty" element={<ProtectedRoute roles={["faculty"]}><FacultyDashboard /></ProtectedRoute>} />
            <Route path="/faculty/subjects/new" element={<ProtectedRoute roles={["faculty"]}><SubjectNew /></ProtectedRoute>} />
            <Route path="/faculty/subjects/:id" element={<ProtectedRoute roles={["faculty"]}><FacultyTopics /></ProtectedRoute>} />
            <Route path="/faculty/subjects/:id/settings" element={<ProtectedRoute roles={["faculty"]}><SubjectSettings /></ProtectedRoute>} />
            <Route path="/faculty/subjects/:id/students" element={<ProtectedRoute roles={["faculty"]}><Roster /></ProtectedRoute>} />
            <Route path="/faculty/subjects/:id/topics" element={<ProtectedRoute roles={["faculty"]}><FacultyTopics /></ProtectedRoute>} />
            <Route path="/faculty/topics/:id" element={<ProtectedRoute roles={["faculty"]}><TopicEditor /></ProtectedRoute>} />
            <Route path="/faculty/topics/:id/quiz" element={<ProtectedRoute roles={["faculty"]}><QuizBuilder /></ProtectedRoute>} />
            <Route path="/faculty/subjects/:id/grading" element={<ProtectedRoute roles={["faculty"]}><GradingQueue /></ProtectedRoute>} />
            <Route path="/faculty/subjects/:id/report" element={<ProtectedRoute roles={["faculty"]}><Report /></ProtectedRoute>} />
            <Route path="/faculty/subjects/:id/report/preview" element={<ProtectedRoute roles={["faculty"]}><Report /></ProtectedRoute>} />
            <Route path="/faculty/subjects/:id/students/:studentId" element={<ProtectedRoute roles={["faculty"]}><StudentScores /></ProtectedRoute>} />

            <Route path="/admin/users" element={<ProtectedRoute roles={["admin"]}><UsersPage /></ProtectedRoute>} />

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
        <SiteFooter />
      </div>
    </ContentProvider>
  );
}