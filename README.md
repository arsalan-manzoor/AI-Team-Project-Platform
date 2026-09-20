# AI-Team-Project-Platform



An AI-powered collaborative platform for managing teams, projects, tasks, milestones, deadlines, documents, resources, comments, notifications, and project progress.



## 1. Project Overview



The platform is being developed as a collaborative project-management workspace.



The initial version focuses on reliable project-management functionality. AI, machine learning, automation, and AI-agent capabilities are planned for later stages.



### Technology Stack



* Frontend: React + Vite

* Backend: Node.js + Express.js

* Database: PostgreSQL

* Authentication: JWT + bcrypt

* Version Control: Git + GitHub



## 2. Backend



The backend provides REST APIs for authentication, users, teams, projects, tasks, subtasks, milestones, comments, resources, and notifications.



Backend server:



`http://localhost:5000`



API base path:



`/api`



### API Route Groups



| Route                | Purpose                                  |

| -------------------- | ---------------------------------------- |

| `/api/auth`          | Login and authenticated user information |

| `/api/users`         | User registration and user information   |

| `/api/teams`         | Team management and team members         |

| `/api/projects`      | Project management                       |

| `/api/tasks`         | Task management and assignment           |

| `/api/subtasks`      | Subtask management                       |

| `/api/milestones`    | Project milestone management             |

| `/api/comments`      | Task/project comments                    |

| `/api/resources`     | Project resources                        |

| `/api/notifications` | User notifications                       |



## 3. Authentication



Authentication uses JSON Web Tokens (JWT).



Login is performed through:



`POST /api/auth/login`



A successful login returns an access token.



Protected endpoints require:



`Authorization: Bearer <token>`



The authenticated user's information can be retrieved through:



`GET /api/auth/me`



Passwords are hashed using bcrypt and are never returned through API responses.



JWT configuration is stored outside source code using environment variables.



## 4. Authorization



Protected resources verify both authentication and the user's relationship with the relevant team or project.



### Teams



* A user can create a team.

* Team members can view the teams they belong to.

* Team membership is required to access protected team information.

* Team creators have creator-level management permissions.

* Adding and removing members is restricted to the team creator.



### Projects



* Creating a project requires membership in the selected team.

* Users can view projects belonging to teams they are members of.

* Project creators have creator-level update and delete permissions.



### Tasks



* Tasks belong to projects.

* Access to tasks is restricted through project-team membership.

* Task creation requires access to the project.

* Assigned users must belong to the project's team.

* Task updates require the authenticated user to have access to the project and the creator permission required by the current API contract.

* Task deletion requires the task creator.



### Subtasks



* Subtasks belong to tasks.

* Access is verified through the parent task's project and team membership.



### Milestones



* Milestones belong to projects.

* Access requires membership in the project's team.



### Comments



* Comments may belong to a task or project.

* Access requires authorization for the associated task/project.

* Users can update or delete their own comments.



### Resources



* Resources belong to projects.

* Access requires project-team membership.

* Resource update and deletion are restricted to the resource uploader.



### Notifications



* Notifications belong to individual users.

* Users can only read or modify their own notifications.



## 5. Notification Flow



The backend creates notifications for relevant task-assignment events.



When a task is created and assigned to another team member, the assigned user receives a notification.



When an existing task is reassigned to a different user, the new assignee receives a notification.



Notification endpoints include:



* `GET /api/notifications`

* `GET /api/notifications/unread`

* `PUT /api/notifications/read-all`

* `PUT /api/notifications/:id/read`



Notification ownership is checked so that one user cannot mark another user's notification as read.



## 6. Database



The PostgreSQL database is named `zyra`.



Current core tables:



* `users`

* `teams`

* `team_members`

* `projects`

* `tasks`

* `subtasks`

* `milestones`

* `comments`

* `resources`

* `notifications`



Important relationships include:



* Teams have creators and members.

* Projects belong to teams and have creators.

* Tasks belong to projects and may be assigned to users.

* Subtasks belong to tasks.

* Milestones belong to projects.

* Comments may reference tasks or projects.

* Resources belong to projects.

* Notifications belong to users.



Foreign-key relationships and cascading b
