import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTickets } from "../../hooks/useTickets";
import DashboardCard from "../../components/Dashboard/DashboardCard";
import TicketTable from "../../components/Tickets/TicketTable";
import Loading from "../../components/common/Loading";
import ErrorState from "../../components/common/ErrorState";
import EmptyState from "../../components/common/EmptyState";

const Dashboard = () => {
  const navigate = useNavigate();
  const { currentUser, isAdmin, isAgent, isEmployee } = useAuth();
  const { tickets, loading, error } = useTickets();

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  // 1. ADMIN DASHBOARD METRICS (Section 2, Page 3)
  // Total, Open, Assigned, In Progress, Pending, Resolved, Closed, Critical, Unassigned
  const adminStats = {
    total: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    assigned: tickets.filter((t) => t.status === "assigned").length,
    inProgress: tickets.filter((t) => t.status === "in_progress").length,
    pending: tickets.filter((t) => t.status === "pending").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
    closed: tickets.filter((t) => t.status === "closed").length,
    critical: tickets.filter((t) => t.priority === "critical").length,
    unassigned: tickets.filter((t) => !t.assignedAgent).length,
  };

  // 2. SUPPORT AGENT DASHBOARD METRICS (Section 2, Page 3 & 4)
  // My Assigned Tickets, New Tickets, In Progress, Pending, Resolved, High Priority
 const agentTickets = tickets.filter(
  (t) =>
    t.assignedAgent === currentUser?.id ||
    t.assignedAgent === null
);

const agentStats = {
  myAssigned: tickets.filter(
    (t) => t.assignedAgent === currentUser?.id
  ).length,

  newTickets: tickets.filter(
    (t) => t.status === "open" && !t.assignedAgent
  ).length,

  inProgress: agentTickets.filter(
    (t) =>
      t.assignedAgent === currentUser?.id &&
      t.status === "in_progress"
  ).length,

  pending: agentTickets.filter(
    (t) =>
      t.assignedAgent === currentUser?.id &&
      t.status === "pending"
  ).length,

  resolved: agentTickets.filter(
    (t) =>
      t.assignedAgent === currentUser?.id &&
      t.status === "resolved"
  ).length,

  highPriority: agentTickets.filter(
    (t) =>
      (t.assignedAgent === currentUser?.id || !t.assignedAgent) &&
      (t.priority === "high" || t.priority === "critical")
  ).length,
};

  // 3. EMPLOYEE DASHBOARD METRICS (Section 2, Page 4)
  // My Total Tickets, Open Tickets, In Progress Tickets, Resolved Tickets, Closed Tickets
  const employeeTickets = tickets.filter(
    (t) => t.createdBy === currentUser?.id
  );
  const employeeStats = {
    myTotal: employeeTickets.length,
    open: employeeTickets.filter((t) => t.status === "open").length,
    inProgress: employeeTickets.filter(
      (t) => t.status === "in_progress" || t.status === "assigned"
    ).length,
    resolved: employeeTickets.filter((t) => t.status === "resolved").length,
    closed: employeeTickets.filter((t) => t.status === "closed").length,
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 bg-gray-50 dark:bg-gray-950 transition-colors min-h-screen">
      {/* Header with Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {isAdmin && "Admin Command Center"}
            {isAgent && "Support Agent Workspace"}
            {isEmployee && "Employee Support Portal"}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Welcome back, <span className="font-semibold text-gray-700 dark:text-gray-300">{currentUser?.name}</span>. Here is your ticket activity.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {isEmployee && (
            <Link
              to="/tickets?action=create"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 dark:bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New Ticket
            </Link>
          )}

          <Link
            to="/tickets"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {isAdmin ? "View All Tickets" : "View My Tickets"}
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>

      {/* ADMIN METRICS GRID - 9 Cards */}
      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
          <DashboardCard title="Total Tickets" value={adminStats.total} description="All recorded issues" badgeColor="blue" />
          <DashboardCard title="Open Tickets" value={adminStats.open} description="Waiting for triage" badgeColor="amber" />
          <DashboardCard title="Assigned Tickets" value={adminStats.assigned} description="Allocated to agents" badgeColor="purple" />
          <DashboardCard title="In Progress Tickets" value={adminStats.inProgress} description="Under active investigation" badgeColor="blue" />
          <DashboardCard title="Pending Tickets" value={adminStats.pending} description="Waiting on user/vendor" badgeColor="amber" />
          <DashboardCard title="Resolved Tickets" value={adminStats.resolved} description="Solution provided" badgeColor="emerald" />
          <DashboardCard title="Closed Tickets" value={adminStats.closed} description="Verified and closed" badgeColor="emerald" />
          <DashboardCard title="Critical Tickets" value={adminStats.critical} description="Highest urgency" badgeColor="amber" />
          <DashboardCard title="Unassigned Tickets" value={adminStats.unassigned} description="Requires agent assignment" badgeColor="purple" />
        </div>
      )}

      {/* SUPPORT AGENT METRICS GRID - 6 Cards */}
      {isAgent && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <DashboardCard title="My Assigned Tickets" value={agentStats.myAssigned} description="Tickets allocated to you" badgeColor="purple" />
          <DashboardCard title="New Tickets" value={agentStats.newTickets} description="Open unhandled pool" badgeColor="blue" />
          <DashboardCard title="In Progress Tickets" value={agentStats.inProgress} description="Your ongoing tasks" badgeColor="blue" />
          <DashboardCard title="Pending Tickets" value={agentStats.pending} description="Awaiting employee reply" badgeColor="amber" />
          <DashboardCard title="Resolved Tickets" value={agentStats.resolved} description="Resolved by you" badgeColor="emerald" />
          <DashboardCard title="High Priority Tickets" value={agentStats.highPriority} description="Urgent issues requiring action" badgeColor="amber" />
        </div>
      )}

      {/* EMPLOYEE METRICS GRID - 5 Cards */}
      {isEmployee && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <DashboardCard title="My Total Tickets" value={employeeStats.myTotal} description="All your requests" badgeColor="blue" />
          <DashboardCard title="Open Tickets" value={employeeStats.open} description="Waiting for support" badgeColor="amber" />
          <DashboardCard title="In Progress Tickets" value={employeeStats.inProgress} description="Being handled now" badgeColor="purple" />
          <DashboardCard title="Resolved Tickets" value={employeeStats.resolved} description="Solution ready for review" badgeColor="emerald" />
          <DashboardCard title="Closed Tickets" value={employeeStats.closed} description="Completed requests" badgeColor="emerald" />
        </div>
      )}

      {/* Recent Tickets Table Section */}
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isAdmin && "Recent Global Tickets"}
              {isAgent && "My Recent Assigned Tickets"}
              {isEmployee && "My Recent Tickets"}
            </h2>
            <p className="text-xs text-gray-400">
              {isAdmin && "Latest support requests across the organization"}
              {isAgent && "Tickets assigned to you needing attention"}
              {isEmployee && "Track updates on issues you have submitted"}
            </p>
          </div>

          <Link
            to="/tickets"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            Explore all &rarr;
          </Link>
        </div>

        {(() => {
          const displayTickets = isAdmin
            ? tickets.slice(0, 5)
            : isAgent
            ? agentTickets.slice(0, 5)
            : employeeTickets.slice(0, 5);

          if (displayTickets.length === 0) {
            return (
              <EmptyState message="No tickets to display currently." />
            );
          }

          return (
            <TicketTable
              tickets={displayTickets}
              onView={(ticket) => navigate(`/tickets/${ticket.id}`)}
            />
          );
        })()}
      </div>
    </div>
  );
};

export default Dashboard;