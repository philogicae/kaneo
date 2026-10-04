import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import {
  validateAndParseDate,
  validateDateRange,
} from "../utils/validate-dates";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createAppointment from "./controllers/create-appointment";
import createAppointmentFromTask from "./controllers/create-appointment-from-task";
import deleteAppointment from "./controllers/delete-appointment";
import getAppointment from "./controllers/get-appointment";
import listAppointments from "./controllers/list-appointments";
import updateAppointment from "./controllers/update-appointment";
import { appointmentListSchema, appointmentSchema } from "./response";
import {
  appointmentFromTaskBody,
  appointmentParam,
  createAppointmentBody,
  listAppointmentsQuery,
  updateAppointmentBody,
} from "./schema";

const listAppointmentsRoute = createRoute({
  method: "get",
  operationId: "listAppointments",
  path: "/",
  tags: ["Appointments"],
  summary: "List appointments",
  description:
    "List a project's appointments, sorted by start date. Appointments never appear in the board or backlog.",
  middleware: [
    workspaceAccess.fromProjectQuery("projectId"),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { query: listAppointmentsQuery },
  responses: {
    200: jsonResponse("The project's appointments", appointmentListSchema),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the project's workspace"),
  },
});

const createAppointmentRoute = createRoute({
  method: "post",
  operationId: "createAppointment",
  path: "/",
  tags: ["Appointments"],
  summary: "Create appointment",
  description:
    "Add an appointment to a project. It is a task-like scheduled item that stays out of the board and backlog.",
  middleware: [
    workspaceAccess.fromProjectId("projectId"),
    requireWorkspacePermission({ task: ["create"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createAppointmentBody } },
    },
  },
  responses: {
    200: jsonResponse("The created appointment", appointmentSchema),
    400: errorResponse("Invalid body, or unknown project"),
    403: errorResponse(
      "No workspace access, or missing task:create permission",
    ),
  },
});

const appointmentFromTaskRoute = createRoute({
  method: "post",
  operationId: "createAppointmentFromTask",
  path: "/from-task",
  tags: ["Appointments"],
  summary: "Move a backlog task to appointments",
  description:
    "Convert a planned (backlog) task into an appointment. The task row is removed, so the item lives only in the appointment collection.",
  middleware: [
    workspaceAccess.fromTaskId("taskId"),
    requireWorkspacePermission({ task: ["update"] }),
    requireWorkspacePermission({ task: ["create"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: appointmentFromTaskBody } },
    },
  },
  responses: {
    200: jsonResponse("The created appointment", appointmentSchema),
    400: errorResponse(
      "The task is not a backlog task, or its workspace could not be determined",
    ),
    403: errorResponse("No workspace access, or missing task permissions"),
    404: errorResponse("Unknown task"),
  },
});

const getAppointmentRoute = createRoute({
  method: "get",
  operationId: "getAppointment",
  path: "/{id}",
  tags: ["Appointments"],
  summary: "Get appointment",
  description: "Get a single appointment by ID.",
  middleware: [
    workspaceAccess.fromAppointment("id"),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: appointmentParam },
  responses: {
    200: jsonResponse("Appointment details", appointmentSchema),
    400: errorResponse(
      "Unknown appointment, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the project's workspace"),
    404: errorResponse("Appointment not found"),
  },
});

const updateAppointmentRoute = createRoute({
  method: "put",
  operationId: "updateAppointment",
  path: "/{id}",
  tags: ["Appointments"],
  summary: "Update appointment",
  description:
    "Update an appointment's title, description, dates, priority, or assignee.",
  middleware: [
    workspaceAccess.fromAppointment("id"),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    params: appointmentParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateAppointmentBody } },
    },
  },
  responses: {
    200: jsonResponse("The updated appointment", appointmentSchema),
    400: errorResponse("Invalid body, or unknown appointment"),
    403: errorResponse(
      "No workspace access, or missing task:update permission",
    ),
    404: errorResponse("Appointment not found"),
  },
});

const deleteAppointmentRoute = createRoute({
  method: "delete",
  operationId: "deleteAppointment",
  path: "/{id}",
  tags: ["Appointments"],
  summary: "Delete appointment",
  description: "Delete an appointment. Returns the deleted ID.",
  middleware: [
    workspaceAccess.fromAppointment("id"),
    requireWorkspacePermission({ task: ["delete"] }),
  ] as const,
  request: { params: appointmentParam },
  responses: {
    200: jsonResponse(
      "The deleted appointment ID",
      z.object({ id: z.string() }),
    ),
    400: errorResponse("Unknown appointment"),
    403: errorResponse(
      "No workspace access, or missing task:delete permission",
    ),
    404: errorResponse("Appointment not found"),
  },
});

const appointment = apiRouter()
  .openapi(listAppointmentsRoute, async (c) => {
    const { projectId, limit, offset } = c.req.valid("query");
    return c.json(await listAppointments(projectId, { limit, offset }), 200);
  })
  .openapi(createAppointmentRoute, async (c) => {
    const { projectId, ...body } = c.req.valid("json");
    const startDate =
      body.startDate !== undefined
        ? validateAndParseDate(body.startDate, "startDate")
        : undefined;
    const dueDate =
      body.dueDate !== undefined
        ? validateAndParseDate(body.dueDate, "dueDate")
        : undefined;
    validateDateRange(startDate, dueDate);

    return c.json(
      await createAppointment({
        projectId,
        ...body,
        startDate,
        dueDate,
        currentUserId: c.get("userId"),
      }),
      200,
    );
  })
  .openapi(appointmentFromTaskRoute, async (c) => {
    const { taskId } = c.req.valid("json");
    return c.json(
      await createAppointmentFromTask(taskId, c.get("userId")),
      200,
    );
  })
  .openapi(getAppointmentRoute, async (c) =>
    c.json(await getAppointment(c.req.valid("param").id), 200),
  )
  .openapi(updateAppointmentRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const startDate =
      body.startDate !== undefined
        ? validateAndParseDate(body.startDate, "startDate")
        : undefined;
    const dueDate =
      body.dueDate !== undefined
        ? validateAndParseDate(body.dueDate, "dueDate")
        : undefined;
    validateDateRange(startDate, dueDate);

    return c.json(
      await updateAppointment(id, {
        ...body,
        startDate,
        dueDate,
        currentUserId: c.get("userId"),
      }),
      200,
    );
  })
  .openapi(deleteAppointmentRoute, async (c) =>
    c.json(
      await deleteAppointment(c.req.valid("param").id, c.get("userId")),
      200,
    ),
  );

export default appointment;
