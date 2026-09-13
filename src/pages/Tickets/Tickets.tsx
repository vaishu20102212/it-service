import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useTickets } from "../../hooks/useTickets";
import { useCategories } from "../../hooks/useCategories";
import { useUsers } from "../../hooks/useUsers";
import TicketTable from "../../components/Tickets/TicketTable";
import TicketFormModal from "../../components/Tickets/TicketFormModal";
import Pagination from "../../components/common/Pagination";
import Loading from "../../components/common/Loading";
import ErrorState from "../../components/common/ErrorState";
import EmptyState from "../../components/common/EmptyState";
import CollapsiblePanel from "../../components/common/CollapsiblePanel";
import { createTicket, deleteTicket } from "../../services/ticketService";
import { createActivity } from "../../services/activityService";
import type { Ticket, TicketPriority, ContactMethod } from "../../types/ticket";
import type { Activity } from "../../types/activity";

const Tickets = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser, isAdmin, isAgent, isEmployee } = useAuth();
  const { showToast } = useToast();
  const { tickets, loading, error, refetch } = useTickets();
  const { categories } = useCategories();
  const { users } = useUsers();

  // Search & Filter State (Section 14)
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "priority" | "updated">("newest");

  // Pagination State (Section 16)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Create Ticket Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  // Mobile Filter Panel State
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // Auto-open create modal if navigated with ?action=create
  useEffect(() => {
    if (searchParams.get("action") === "create") {
      setIsCreateOpen(true);
    }
  }, [searchParams]);

  // Enforce Role-Based Visibility (Section 1, 2, 25)
  const accessibleTickets = useMemo(() => {
    if (isAdmin) return tickets;
    if (isAgent) {
  return tickets.filter(
    (t) =>
      t.assignedAgent === currentUser?.id ||
      t.assignedAgent === null
  );
}
    if (isEmployee) return tickets.filter((t) => t.createdBy === currentUser?.id);
    return [];
  }, [tickets, isAdmin, isAgent, isEmployee, currentUser]);

  // Section 14: Search by Ticket ID, Subject, Employee Name, Support Agent Name
  // Filter by Status, Priority, Category, Assigned Agent
  const filteredTickets = useMemo(() => {
    return accessibleTickets.filter((ticket) => {
      const q = searchQuery.toLowerCase().trim();

      const creator = users.find((u) => u.id === ticket.createdBy);
      const agent = users.find((u) => u.id === ticket.assignedAgent);

      const matchesSearch =
        !q ||
        ticket.id.toLowerCase().includes(q) ||
        ticket.subject.toLowerCase().includes(q) ||
        (creator && creator.name.toLowerCase().includes(q)) ||
        (agent && agent.name.toLowerCase().includes(q));

      const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;
      const matchesCategory = categoryFilter === "all" || ticket.category === categoryFilter;
      const matchesAgent =
        agentFilter === "all" ||
        (agentFilter === "unassigned" ? !ticket.assignedAgent : ticket.assignedAgent === agentFilter);

      return matchesSearch && matchesStatus && matchesPriority && matchesCategory && matchesAgent;
    });
  }, [accessibleTickets, searchQuery, statusFilter, priorityFilter, categoryFilter, agentFilter, users]);

  // Section 14: Sorting (Newest, Oldest, Highest Priority, Recently Updated)
  const sortedTickets = useMemo(() => {
    const list = [...filteredTickets];
    const priorityWeights: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    switch (sortBy) {
      case "newest":
        return list.sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
      case "oldest":
        return list.sort((a, b) => new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime());
      case "priority":
        return list.sort((a, b) => (priorityWeights[b.priority] || 0) - (priorityWeights[a.priority] || 0));
      case "updated":
        return list.sort((a, b) => new Date(b.updatedDate || b.createdDate).getTime() - new Date(a.updatedDate || a.createdDate).getTime());
      default:
        return list;
    }
  }, [filteredTickets, sortBy]);

  // Section 16: Pagination Slicing
  const totalPages = Math.ceil(sortedTickets.length / pageSize);
  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedTickets.slice(start, start + pageSize);
  }, [sortedTickets, currentPage, pageSize]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, priorityFilter, categoryFilter, agentFilter, sortBy]);

  const handleCreateSubmit = async (ticketData: {
    subject: string;
    description: string;
    category: string;
    priority: TicketPriority;
    preferredContactMethod: ContactMethod;
  }) => {
    const today = new Date().toISOString().split("T")[0];
    const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const newId = `T${String(tickets.length + 1).padStart(2, "0")}`;

    const newTicket: Ticket = {
      id: newId,
      subject: ticketData.subject,
      description: ticketData.description,
      createdBy: currentUser?.id || "U01",
      assignedAgent: null,
      category: ticketData.category,
      priority: ticketData.priority,
      status: "open",
      createdDate: today,
      updatedDate: today,
      dueDate,
      preferredContactMethod: ticketData.preferredContactMethod,
      resolution: "",
      resolutionNotes: "",
      resolutionDate: null,
    };

    try {
      await createTicket(newTicket);

      // Log initial activity
      const activityObj: Activity = {
        id: `ACT${Date.now().toString().slice(-4)}`,
        ticketId: newId,
        action: "Ticket created",
        actorId: currentUser?.id || "U01",
        actorName: currentUser?.name || "Employee User",
        timestamp: new Date().toISOString(),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        details: `Ticket created with ${ticketData.priority} priority`,
      };
      await createActivity(activityObj);

      showToast("Ticket created successfully", "success");
      refetch();
    } catch {
      showToast("Failed to create ticket", "error");
    }
  };

  const handleDelete = async (ticketId: string) => {
    if (window.confirm(`Are you sure you want to delete ticket ${ticketId}?`)) {
      try {
        await deleteTicket(ticketId);
        showToast("Ticket deleted successfully", "success");
        refetch();
      } catch {
        showToast("Failed to delete ticket", "error");
      }
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6 p-4 sm:p-6 bg-gray-50 dark:bg-gray-950 transition-colors min-h-screen">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {isAdmin && "All Support Tickets"}
            {isAgent && "My Assigned Queue"}
            {isEmployee && "My Submitted Tickets"}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isAdmin && "Review, assign, and manage tickets across the enterprise"}
            {isAgent && "Track and resolve issues assigned directly to you"}
            {isEmployee && "View status, add comments, and track resolutions for your tickets"}
          </p>
        </div>

        {/* Create Ticket Button (Employee & Admin per Matrix Section 25) */}
        {(isEmployee || isAdmin) && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 dark:bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Ticket
          </button>
        )}
      </div>

      {/* Filter and Search Toolbar */}
      <div className="space-y-4">
        {/* Search Input - Always Visible */}
        <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 sm:p-5 shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <svg className="absolute left-3.5 top-3 h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Ticket ID, Subject, Employee name, or Agent name..."
                className="w-full rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 pl-10 pr-4 py-2.5 text-sm outline-none transition focus:border-blue-600 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-600 dark:focus:ring-blue-500"
              />
            </div>

            {/* Mobile Filter Toggle Button */}
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className="md:hidden inline-flex items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors whitespace-nowrap"
              title="Toggle filters"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
            </button>
          </div>
        </div>

        {/* Desktop Filters Grid - Hidden on Mobile */}
        <div className="hidden md:block rounded-2xl bg-white dark:bg-gray-800 p-4 sm:p-5 shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 text-xs">
            {/* Status Filter */}
            <div>
              <label className="block font-semibold uppercase text-gray-400 dark:text-gray-500 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 px-2.5 py-2 outline-none focus:border-blue-600 dark:focus:border-blue-500 transition-colors"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
                <option value="cancelled">Cancelled</option>
                <option value="reopened">Reopened</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="block font-semibold uppercase text-gray-400 dark:text-gray-500 mb-1">Priority</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 px-2.5 py-2 outline-none focus:border-blue-600 dark:focus:border-blue-500 transition-colors"
              >
                <option value="all">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block font-semibold uppercase text-gray-400 dark:text-gray-500 mb-1">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 px-2.5 py-2 outline-none focus:border-blue-600 dark:focus:border-blue-500 transition-colors"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Assigned Agent Filter (Admin only) */}
            {isAdmin && (
              <div>
                <label className="block font-semibold uppercase text-gray-400 dark:text-gray-500 mb-1">Agent</label>
                <select
                  value={agentFilter}
                  onChange={(e) => setAgentFilter(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 px-2.5 py-2 outline-none focus:border-blue-600 dark:focus:border-blue-500 transition-colors"
                >
                  <option value="all">All Agents</option>
                  <option value="unassigned">Unassigned</option>
                  {users
                    .filter((u) => u.role === "support_agent")
                    .map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Sorting */}
            <div>
              <label className="block font-semibold uppercase text-gray-400 dark:text-gray-500 mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 px-2.5 py-2 outline-none focus:border-blue-600 dark:focus:border-blue-500 transition-colors"
              >
                <option value="newest">Newest Tickets</option>
                <option value="oldest">Oldest Tickets</option>
                <option value="priority">Highest Priority</option>
                <option value="updated">Recently Updated</option>
              </select>
            </div>
          </div>
        </div>

        {/* Mobile Collapsible Filter Panel */}
        {showFilterPanel && (
          <div className="md:hidden space-y-3">
            <CollapsiblePanel
              title="Status"
              defaultOpen={true}
              icon={
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            >
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 px-3 py-2 outline-none focus:border-blue-600 dark:focus:border-blue-500 transition-colors"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
                <option value="cancelled">Cancelled</option>
                <option value="reopened">Reopened</option>
              </select>
            </CollapsiblePanel>

            <CollapsiblePanel
              title="Priority"
              defaultOpen={false}
              icon={
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
              }
            >
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 px-3 py-2 outline-none focus:border-blue-600 dark:focus:border-blue-500 transition-colors"
              >
                <option value="all">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </CollapsiblePanel>

            <CollapsiblePanel
              title="Category"
              defaultOpen={false}
              icon={
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              }
            >
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 px-3 py-2 outline-none focus:border-blue-600 dark:focus:border-blue-500 transition-colors"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </CollapsiblePanel>

            {isAdmin && (
              <CollapsiblePanel
                title="Assigned Agent"
                defaultOpen={false}
                icon={
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              >
                <select
                  value={agentFilter}
                  onChange={(e) => {
                    setAgentFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 px-3 py-2 outline-none focus:border-blue-600 dark:focus:border-blue-500 transition-colors"
                >
                  <option value="all">All Agents</option>
                  <option value="unassigned">Unassigned</option>
                  {users
                    .filter((u) => u.role === "support_agent")
                    .map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                </select>
              </CollapsiblePanel>
            )}

            <CollapsiblePanel
              title="Sort By"
              defaultOpen={false}
              icon={
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              }
            >
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 px-3 py-2 outline-none focus:border-blue-600 dark:focus:border-blue-500 transition-colors"
              >
                <option value="newest">Newest Tickets</option>
                <option value="oldest">Oldest Tickets</option>
                <option value="priority">Highest Priority</option>
                <option value="updated">Recently Updated</option>
              </select>
            </CollapsiblePanel>
          </div>
        )}
      </div>

      {/* Ticket Table & Pagination */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 sm:p-5 shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
        {sortedTickets.length === 0 ? (
          <EmptyState message="No matching tickets found." />
        ) : (
          <>
            <TicketTable
              tickets={paginatedTickets}
              onView={(ticket) => navigate(`/tickets/${ticket.id}`)}
              onDelete={isAdmin ? handleDelete : undefined}
            />

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={sortedTickets.length}
              pageSize={pageSize}
            />
          </>
        )}
      </div>

      {/* Create Ticket Modal */}
      <TicketFormModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        categories={categories}
        onSubmit={handleCreateSubmit}
      />
    </div>
  );
};

export default Tickets;