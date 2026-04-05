# Use case diagrams (PlantUML)

UML **use case** diagrams: **stick-figure** `actor`, **rectangle** system boundary, **usecase** ovals, **association** (`-->`), **«include»** (`.>` dashed), **«extend»** (`<..` dotted).

**Layout (labels inside the boundary).** Graphviz often routes «include»/«extend» along the **left** edge of the use-case cluster, so stereotype text overlaps **actor** associations. These diagrams add a transparent **`agent`** (`COL_GAP`) as a **vertical corridor** between the main stack of use cases and **Register / Login** / **Sign in to admin**. Hidden links (`-[hidden]right-`) pull that column to the **right** so dashed dependency labels sit **inside** the system rectangle, **to the right** of the primary ovals. Tune `skinparam nodesep` / `ranksep` if the figure is too wide for your PDF.

**Source files** (edit and render from disk):

- [`plantuml/use-case-user.puml`](./plantuml/use-case-user.puml) — Decision System Advisor (end user)
- [`plantuml/use-case-admin.puml`](./plantuml/use-case-admin.puml) — DSA admin backend

**Render**

1. [PlantUML Web Server](https://www.plantuml.com/plantuml/uml/) — paste file contents or encode URL.
2. **VS Code / Cursor:** [PlantUML extension](https://marketplace.visualstudio.com/items?itemName=jebbs.plantuml) + Graphviz (or built-in server).
3. **CLI:** `java -jar plantuml.jar docs/plantuml/use-case-user.puml` → PNG/SVG in the same folder.

---

## 1. User — Decision System Advisor

**User** is **not** directly associated with **Receive Advisory Signals** (only via **«include»** from **View Charts & Market Data**).

```plantuml
@startuml Decision_System_Advisor_Use_Cases
title Decision System Advisor — use cases
skinparam dpi 120
skinparam defaultFontSize 13
skinparam nodesep 48
skinparam ranksep 38
skinparam usecase {
  BorderColor #333333
  BackgroundColor #F8F8F8
}
skinparam actor {
  BorderColor #333333
}

left to right direction

actor User

rectangle "Decision System Advisor" {
  agent " " as COL_GAP #Transparent;line:Transparent

  usecase "Manage User Profile" as UC_PROF
  usecase "Select Analysis Strategy" as UC_STRAT
  usecase "View Charts & Market Data" as UC_CHART
  usecase "Receive Advisory Signals" as UC_ADV
  usecase "Read Indicator Explanation" as UC_IND
  usecase "Chat with AI Assistant" as UC_CHAT
  usecase "Register / Login" as UC_REG

  UC_PROF -[hidden]down- UC_STRAT
  UC_STRAT -[hidden]down- UC_CHART
  UC_CHART -[hidden]down- UC_ADV
  UC_ADV -[hidden]down- UC_IND
  UC_IND -[hidden]down- UC_CHAT

  UC_PROF -[hidden]right- COL_GAP
  UC_STRAT -[hidden]right- COL_GAP
  UC_CHART -[hidden]right- COL_GAP
  UC_ADV -[hidden]right- COL_GAP
  UC_IND -[hidden]right- COL_GAP
  UC_CHAT -[hidden]right- COL_GAP
  COL_GAP -[hidden]right- UC_REG

  UC_PROF .> UC_REG : <<include>> Authenticate
  UC_STRAT .> UC_REG : <<include>> Authenticate
  UC_CHART .> UC_ADV : <<include>> Show signals
  UC_IND <.. UC_CHAT : <<extend>> Ask meaning
}

User --> UC_REG
User --> UC_PROF
User --> UC_STRAT
User --> UC_CHART
User --> UC_IND
User --> UC_CHAT

note left of User
  User is **not** associated with
  **Receive Advisory Signals**
  (only via <<include>> from
  **View Charts & Market Data**).
end note

@enduml
```

**Relationship summary**

| Type | From | To | Label |
|------|------|-----|--------|
| association | User | Register / Login, Manage Profile, Select Strategy, View Charts, Read Indicator, Chat with AI | — |
| «include» | Manage User Profile | Register / Login | Authenticate |
| «include» | Select Analysis Strategy | Register / Login | Authenticate |
| «include» | View Charts & Market Data | Receive Advisory Signals | Show signals |
| «extend» | Chat with AI Assistant | Read Indicator Explanation | Ask meaning |

PlantUML: `UC_IND <.. UC_CHAT : <<extend>>` — arrow from extension to base (**Chat** extends **Read Indicator**).

---

## 2. Administrator / staff — DSA admin backend

Each operational use case **«include»**s **Sign in to admin** for authentication.

```plantuml
@startuml DSA_Admin_Use_Cases
title DSA admin backend — use cases
skinparam dpi 120
skinparam defaultFontSize 13
skinparam nodesep 50
skinparam ranksep 40
skinparam usecase {
  BorderColor #333333
  BackgroundColor #F8F8F8
}
skinparam actor {
  BorderColor #333333
}

left to right direction

actor "Administrator / staff" as Admin

rectangle "DSA admin backend" {
  agent " " as COL_GAP #Transparent;line:Transparent

  usecase "Configure / monitor email" as UC_MAIL
  usecase "View service logs" as UC_LOGS
  usecase "View statistics" as UC_STATS
  usecase "Manage news" as UC_NEWS
  usecase "Manage companies / symbols" as UC_COMP
  usecase "Manage users" as UC_USERS
  usecase "Open admin dashboard" as UC_DASH
  usecase "Sign in to admin" as UC_LOGIN

  UC_MAIL -[hidden]down- UC_LOGS
  UC_LOGS -[hidden]down- UC_STATS
  UC_STATS -[hidden]down- UC_NEWS
  UC_NEWS -[hidden]down- UC_COMP
  UC_COMP -[hidden]down- UC_USERS
  UC_USERS -[hidden]down- UC_DASH

  UC_MAIL -[hidden]right- COL_GAP
  UC_LOGS -[hidden]right- COL_GAP
  UC_STATS -[hidden]right- COL_GAP
  UC_NEWS -[hidden]right- COL_GAP
  UC_COMP -[hidden]right- COL_GAP
  UC_USERS -[hidden]right- COL_GAP
  UC_DASH -[hidden]right- COL_GAP
  COL_GAP -[hidden]right- UC_LOGIN

  UC_DASH .> UC_LOGIN : <<include>> Authenticate
  UC_USERS .> UC_LOGIN : <<include>> Authenticate
  UC_COMP .> UC_LOGIN : <<include>> Authenticate
  UC_NEWS .> UC_LOGIN : <<include>> Authenticate
  UC_STATS .> UC_LOGIN : <<include>> Authenticate
  UC_LOGS .> UC_LOGIN : <<include>> Authenticate
  UC_MAIL .> UC_LOGIN : <<include>> Authenticate
}

Admin --> UC_LOGIN
Admin --> UC_DASH
Admin --> UC_USERS
Admin --> UC_COMP
Admin --> UC_NEWS
Admin --> UC_STATS
Admin --> UC_LOGS
Admin --> UC_MAIL

note bottom of Admin
  Omit **Admin --> Sign in** if you want
  authentication only via <<include>>
  from other use cases.
end note

@enduml
```

---

## 3. Compact overview (Mermaid, no UML actor)

Optional high-level map without actors (not PlantUML use-case notation).

```mermaid
flowchart LR
  subgraph U_area["User-facing"]
    direction TB
    u1([Rankings & trading])
    u2([Profile & auth])
    u3([Charts & advisory])
  end
  subgraph A_area["Admin"]
    direction TB
    a1([Users & roles])
    a2([Content & ops])
  end
```

---

## Export for thesis

1. Open [`use-case-user.puml`](./plantuml/use-case-user.puml) and [`use-case-admin.puml`](./plantuml/use-case-admin.puml) in a PlantUML-capable tool.  
2. Export **SVG** or **PNG** (vector SVG scales better in PDF).  
3. Caption may use **«include»** / **«extend»** (Unicode guillemets) to match UML.

---

## See also

[`architecture-diagrams.md`](./architecture-diagrams.md) · [`sequence-diagrams.md`](./sequence-diagrams.md)
