import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useCategories } from "../../hooks/useCategories";
import { useUsers } from "../../hooks/useUsers";
import { getTicketById, updateTicket, deleteTicket } from "../../services/ticketService";
import { getCommentsByTicketId, createComment } from "../../services/commentService";
import { getActivitiesByTicketId, createActivity } from "../../services/activityService";
import TicketStatusBadge from "../../components/Tickets/TicketStatusBadge";
import TicketPriorityBadge from "../../components/Tickets/TicketPriorityBadge";
import CommentList from "../../components/Comments/CommentList";
import ActivityTimeline from "../../components/Tickets/ActivityTimeline";
import AssignmentModal from "../../components/Tickets/AssignmentModal";
import ResolutionModal from "../../components/Tickets/ResolutionModal";
import TicketFormModal from "../../components/Tickets/TicketFormModal";
import Loading from "../../components/common/Loading";
import ErrorState from "../../components/common/ErrorState";
import EmptyState from "../../components/common/EmptyState";
import { formatDate } from "../../utils/formatDate";
import type { Ticket, TicketStatus, TicketPriority } from "../../types/ticket";
import type { Comment } from "../../types/comment";
import type { Activity } from "../../types/activity";

const TicketDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
const { currentUser, isAdmin, isAgent, isEmployee, canEditTicket, canDeleteTicket, canAssignTicket } = useAuth();
  const { showToast } = useToast();
  const { categories } = useCategories();
  const { users } = useUsers();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modals
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isResolutionModalOpen, setIsResolutionModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // New Comment input
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const fetchDetails = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError("");
      const ticketData = await getTicketById(id);

      // Enforce RBAC visibility per Section 1, 2, 8
      if (isEmployee && ticketData.createdBy !== currentUser?.id) {
        setError("You do not have permission to view this ticket.");
        setLoading(false);
        return;
      }
      if (
  isAgent &&
  ticketData.assignedAgent !== currentUser?.id &&
  ticketData.assignedAgent !== null
) {
  setError("You are not authorized to view this ticket.");
  setLoading(false);
  return;
}

      setTicket(ticketData);

      const [commentsData, activitiesData] = await Promise.all([
        getCommentsByTicketId(id),
        getActivitiesByTicketId(id),
      ]);
      setComments(commentsData);
      setActivities(activitiesData);
    } catch {
      setError("Failed to load ticket details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [id, currentUser]);

  const logActivity = async (action: string, details?: string) => {
    if (!ticket) return;
    const now = new Date();
    const activityObj: Activity = {
      id: `ACT${Date.now().toString().slice(-4)}`,
      ticketId: ticket.id,
      action,
      actorId: currentUser?.id || "U01",
      actorName: currentUser?.name || "User",
      timestamp: now.toISOString(),
      time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      details,
    };
    await createActivity(activityObj);
    setActivities((prev) => [...prev, activityObj]);
  };

  // Section 4 & 6: Ticket Lifecycle Transitions
  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!ticket) return;

    if (newStatus === "resolved") {
      setIsResolutionModalOpen(true);
      return;
    }

    try {
      const today = new Date().toISOString().split("T")[0];
      const updated = await updateTicket(ticket.id, {
        status: newStatus,
        updatedDate: today,
      });
      setTicket(updated);
      await logActivity(`Status changed to ${newStatus.replace("_", " ")}`);
      showToast(`Status updated to ${newStatus.replace("_", " ")}`, "success");
    } catch {
      showToast("Failed to update ticket status", "error");
    }
  };

  // Section 8: Assignment
  const handleAssignAgent = async (ticketId: string, agentId: string | null) => {
    try {
      const targetAgent = users.find((u) => u.id === agentId);
      const today = new Date().toISOString().split("T")[0];
      const newStatus = agentId ? "assigned" : "open";

      const updated = await updateTicket(ticketId, {
        assignedAgent: agentId,
        status: newStatus,
        updatedDate: today,
      });
      setTicket(updated);

      const actText = agentId
        ? `Ticket assigned to ${targetAgent?.name || agentId}`
        : "Ticket unassigned";
      await logActivity(actText, `Status set to ${newStatus}`);
      showToast(actText, "success");
    } catch {
      showToast("Failed to assign ticket", "error");
    }
  };

  // Section 10: Resolution
  const handleResolveTicket = async (ticketId: string, resolution: string, resolutionNotes: string) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const updated = await updateTicket(ticketId, {
        status: "resolved",
        resolution,
        resolutionNotes,
        resolutionDate: today,
        updatedDate: today,
      });
      setTicket(updated);
      await logActivity("Ticket resolved", resolution);
      showToast("Ticket marked as Resolved", "success");
    } catch {
      showToast("Failed to resolve ticket", "error");
    }
  };

  // Section 6: Edit Ticket
  const handleEditTicket = async (ticketData: {
    subject: string;
    description: string;
    category: string;
    priority: TicketPriority;
    preferredContactMethod: string;
  }) => {
    if (!ticket) return;
    try {
      const updated = await updateTicket(ticket.id, {
        ...ticketData,
        preferredContactMethod: ticketData.preferredContactMethod as any,
        updatedDate: new Date().toISOString().split("T")[0],
      });
      setTicket(updated);
      await logActivity("Ticket details updated", "Subject / Category / Priority edited");
      showToast("Ticket updated successfully", "success");
    } catch {
      showToast("Failed to edit ticket", "error");
    }
  };

  // Delete ticket (Admin only)
  const handleDelete = async () => {
    if (!ticket) return;
    if (window.confirm(`Are you sure you want to permanently delete ticket ${ticket.id}?`)) {
      try {
        await deleteTicket(ticket.id);
        showToast("Ticket deleted successfully", "success");
        navigate("/tickets");
      } catch {
        showToast("Failed to delete ticket", "error");
      }
    }
  };

  // Section 9: Comments
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !ticket) return;

    setSubmittingComment(true);
    try {
      const now = new Date();
      const newComment: Comment = {
        id: `C${Date.now().toString().slice(-4)}`,
        ticketId: ticket.id,
        userId: currentUser?.id || "U01",
        comment: commentText.trim(),
        createdDate: now.toISOString().split("T")[0],
        createdTime: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      await createComment(newComment);
      setComments((prev) => [...prev, newComment]);
      await logActivity(`Comment added by ${currentUser?.name || "User"}`);
      showToast("Comment posted", "success");
      setCommentText("");
    } catch {
      showToast("Failed to post comment", "error");
    } finally {
      setSubmittingComment(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  if (!ticket) return <EmptyState message="Ticket not found." />;

  const creatorUser = users.find((u) => u.id === ticket.createdBy);
  const assignedAgentUser = users.find((u) => u.id === ticket.assignedAgent);

  const canComment =
    isAdmin ||
    (isAgent && ticket.assignedAgent === currentUser?.id) ||
    (isEmployee && ticket.createdBy === currentUser?.id);

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      {/* Top breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/tickets"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition shadow-sm"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-500 text-sm">{ticket.id}</span>
              <TicketStatusBadge status={ticket.status} />
              <TicketPriorityBadge priority={ticket.priority} />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">
              {ticket.subject}
            </h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {canAssignTicket() && (
            <button
              onClick={() => setIsAssignModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition shadow-sm"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {ticket.assignedAgent ? "Reassign Agent" : "Assign Agent"}
            </button>
          )}

          {canEditTicket(ticket) && (
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition shadow-sm"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Ticket
            </button>
          )}

          {canDeleteTicket() && (
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 transition shadow-sm"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Details, Lifecycle Actions, Comments */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Ticket Card */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
              Problem Description
            </h2>
            <div className="rounded-xl bg-gray-50 p-4 border border-gray-100 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
              {ticket.description}
            </div>

            {/* Lifecycle Status Transitions (Section 4 & 6) */}
            <div className="pt-3 border-t border-gray-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2.5">
                Ticket Lifecycle Actions
              </h3>
              <div className="flex flex-wrap gap-2">
                {/* Employee Actions */}
                {isEmployee && (
                  <>
                    {ticket.status === "open" && (
                      <button
                        onClick={() => handleStatusChange("cancelled")}
                        className="rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
                      >
                        Cancel Ticket
                      </button>
                    )}
                    {ticket.status === "resolved" && (
                      <button
                        onClick={() => handleStatusChange("reopened")}
                        className="rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition"
                      >
                        Reopen Ticket
                      </button>
                    )}
                  </>
                )}

                {/* Support Agent Actions */}
                {isAgent && ticket.assignedAgent === currentUser?.id && (
                  <>
                    {ticket.status === "assigned" && (
                      <button
                        onClick={() => handleStatusChange("in_progress")}
                        className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition"
                      >
                        Start Progress
                      </button>
                    )}
                    {ticket.status === "in_progress" && (
                      <>
                        <button
                          onClick={() => handleStatusChange("pending")}
                          className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition"
                        >
                          Mark Pending
                        </button>
                        <button
                          onClick={() => setIsResolutionModalOpen(true)}
                          className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                        >
                          Resolve Ticket
                        </button>
                      </>
                    )}
                    {ticket.status === "pending" && (
                      <button
                        onClick={() => handleStatusChange("in_progress")}
                        className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition"
                      >
                        Resume to In Progress
                      </button>
                    )}
                    {ticket.status === "resolved" && (
                      <button
                        onClick={() => handleStatusChange("closed")}
                        className="rounded-lg bg-gray-800 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-gray-900 transition"
                      >
                        Close Ticket
                      </button>
                    )}
                  </>
                )}

                {/* Admin Actions: Full lifecycle control */}
                {isAdmin && (
                  <div className="flex flex-wrap gap-1.5">
                    {(["open", "assigned", "in_progress", "pending", "resolved", "closed", "cancelled", "reopened"] as TicketStatus[]).map(
                      (st) => (
                        <button
                          key={st}
                          disabled={ticket.status === st}
                          onClick={() => handleStatusChange(st)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition ${
                            ticket.status === st
                              ? "bg-gray-200 text-gray-500 cursor-default"
                              : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          {st.replace("_", " ")}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 10: Resolution Management Card */}
          {(ticket.resolution || ticket.status === "resolved" || ticket.status === "closed") && (
            <div className="rounded-2xl bg-emerald-50/50 p-6 shadow-sm border border-emerald-100 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Resolution Details
                </h3>
                <span className="text-xs text-emerald-700 font-medium">
                  Resolved on {ticket.resolutionDate ? formatDate(ticket.resolutionDate) : "Recently"}
                </span>
              </div>
              <div className="rounded-xl bg-white p-4 border border-emerald-100 space-y-2">
                <p className="text-xs font-bold text-gray-700">Resolution:</p>
                <p className="text-sm font-medium text-emerald-900">{ticket.resolution || "Resolved"}</p>
                {ticket.resolutionNotes && (
                  <>
                    <p className="text-xs font-bold text-gray-700 pt-2 border-t border-gray-100">Notes:</p>
                    <p className="text-xs text-gray-600">{ticket.resolutionNotes}</p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Section 9: Comments Thread */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center justify-between">
              <span>Discussion & Comments</span>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                {comments.length}
              </span>
            </h3>

            {comments.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-2">No comments added yet.</p>
            ) : (
              <CommentList comments={comments} />
            )}

            {canComment && (
              <form onSubmit={handleAddComment} className="pt-3 border-t border-gray-100 space-y-2">
                <textarea
                  rows={2}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Type a comment or status update..."
                  className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submittingComment || !commentText.trim()}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-sm"
                  >
                    {submittingComment ? "Posting..." : "Post Comment"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right 1 Column: Metadata Sidebar & Activity History */}
        <div className="space-y-6">
          {/* Metadata Card */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-4 text-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Ticket Information
            </h3>

            <div className="space-y-3 divide-y divide-gray-100">
              <div className="pt-2 flex justify-between items-center">
                <span className="text-xs text-gray-500">Category</span>
                <span className="font-semibold text-gray-800">{ticket.category}</span>
              </div>

              <div className="pt-2 flex justify-between items-center">
                <span className="text-xs text-gray-500">Created By</span>
                <span className="font-semibold text-gray-800">
                  {creatorUser ? creatorUser.name : ticket.createdBy}
                </span>
              </div>

              <div className="pt-2 flex justify-between items-center">
                <span className="text-xs text-gray-500">Assigned Agent</span>
                <span className="font-semibold text-blue-600">
                  {assignedAgentUser ? assignedAgentUser.name : "Unassigned"}
                </span>
              </div>

              <div className="pt-2 flex justify-between items-center">
                <span className="text-xs text-gray-500">Contact Method</span>
                <span className="font-semibold capitalize text-gray-800">
                  {ticket.preferredContactMethod || "email"}
                </span>
              </div>

              <div className="pt-2 flex justify-between items-center">
                <span className="text-xs text-gray-500">Created Date</span>
                <span className="font-semibold text-gray-800">
                  {formatDate(ticket.createdDate)}
                </span>
              </div>

              <div className="pt-2 flex justify-space-between items-center">
                <span className="text-xs text-gray-500">Updated Date</span>
                <span className="font-semibold text-gray-800">
                  {formatDate(ticket.updatedDate)}
                </span>
              </div>

              <div className="pt-2 flex justify-between items-center">
                <span className="text-xs text-gray-500">Due Date</span>
                <span className="font-semibold text-gray-800">
                  {formatDate(ticket.dueDate)}
                </span>
              </div>
            </div>
          </div>

          {/* Section 11: Activity Timeline Card */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Activity History
            </h3>
            <ActivityTimeline activities={activities} />
          </div>
        </div>
      </div>

      {/* Assignment Modal */}
      <AssignmentModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        ticket={ticket}
        agents={users}
        onAssign={handleAssignAgent}
      />

      {/* Resolution Modal */}
      <ResolutionModal
        isOpen={isResolutionModalOpen}
        onClose={() => setIsResolutionModalOpen(false)}
        ticket={ticket}
        onResolve={handleResolveTicket}
      />

      {/* Edit Ticket Form Modal */}
      <TicketFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        initialTicket={ticket}
        categories={categories}
        isEdit={true}
        onSubmit={handleEditTicket}
      />
    </div>
  );
};

export default TicketDetails;