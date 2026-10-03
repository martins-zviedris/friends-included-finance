create type employee_role as enum ('MANAGER', 'SALESPERSON', 'EXPENSE_REPORTER');
create type transaction_origin as enum ('WEB', 'TELEGRAM');
create type sync_status as enum ('PENDING', 'SYNCED', 'FAILED');
create type delivery_status as enum ('NOT_REQUIRED', 'PENDING', 'SENT', 'FAILED');
create type sale_status as enum ('PENDING', 'APPROVED');
create type expense_status as enum ('AWAITING_ALLOCATION', 'ALLOCATED');
create type project_key as enum ('A', 'B');
create type allocation_key as enum ('A', 'B', 'OVERHEAD');

create table employees (
  key text primary key,
  name text not null,
  role employee_role not null,
  telegram_user_id text unique,
  linked_chat_id text,
  created_at timestamptz not null default now()
);

insert into employees (key, name, role) values
  ('svetlana', 'Svetlana de Monte Carlo', 'MANAGER'),
  ('richard', 'Richard “Call Me Dick” Darling', 'SALESPERSON'),
  ('anastasia', 'Anastasia Ferrari', 'SALESPERSON'),
  ('jean-claude', 'Jean-Claude Bērziņš', 'SALESPERSON'),
  ('kevin', 'Kevin von Whatever', 'EXPENSE_REPORTER');

create table sales (
  reference text primary key check (length(trim(reference)) > 0),
  submitted_at timestamptz not null default now(),
  salesperson_key text not null references employees(key),
  customer text not null check (length(trim(customer)) > 0),
  project project_key not null,
  description text not null check (length(trim(description)) > 0),
  amount_cents bigint not null check (amount_cents > 0),
  proposed_richard smallint not null check (proposed_richard between 0 and 100),
  proposed_anastasia smallint not null check (proposed_anastasia between 0 and 100),
  proposed_jean_claude smallint not null check (proposed_jean_claude between 0 and 100),
  approved_richard smallint check (approved_richard between 0 and 100),
  approved_anastasia smallint check (approved_anastasia between 0 and 100),
  approved_jean_claude smallint check (approved_jean_claude between 0 and 100),
  commission_pool_cents bigint not null default 0,
  richard_commission_cents bigint not null default 0,
  anastasia_commission_cents bigint not null default 0,
  jean_claude_commission_cents bigint not null default 0,
  status sale_status not null default 'PENDING',
  origin transaction_origin not null,
  origin_chat_id text,
  sheets_sync_status sync_status not null default 'PENDING',
  sheets_sync_error text,
  notification_status delivery_status not null default 'NOT_REQUIRED',
  notification_error text,
  approved_at timestamptz,
  constraint proposed_split_100 check (proposed_richard + proposed_anastasia + proposed_jean_claude = 100),
  constraint approved_split_complete check (
    (status = 'PENDING' and approved_richard is null and approved_anastasia is null and approved_jean_claude is null)
    or
    (status = 'APPROVED' and approved_richard + approved_anastasia + approved_jean_claude = 100)
  )
);

create table expenses (
  reference text primary key check (length(trim(reference)) > 0),
  submitted_at timestamptz not null default now(),
  reporter_key text not null references employees(key),
  description text not null check (length(trim(description)) > 0),
  category text not null check (category in ('MATERIALS', 'TRAVEL', 'OTHER')),
  amount_cents bigint not null check (amount_cents > 0),
  proposed_allocation allocation_key not null,
  final_allocation allocation_key,
  status expense_status not null,
  origin transaction_origin not null,
  origin_chat_id text,
  sheets_sync_status sync_status not null default 'PENDING',
  sheets_sync_error text,
  notification_status delivery_status not null default 'NOT_REQUIRED',
  notification_error text,
  allocated_at timestamptz,
  constraint allocation_state check (
    (status = 'AWAITING_ALLOCATION' and final_allocation is null)
    or
    (status = 'ALLOCATED' and final_allocation is not null)
  )
);

create table audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_key text references employees(key),
  action text not null,
  transaction_type text not null check (transaction_type in ('SALE', 'EXPENSE', 'EMPLOYEE_LINK')),
  reference text not null,
  details jsonb not null default '{}'::jsonb
);

create index sales_status_idx on sales(status);
create index expenses_status_idx on expenses(status);
create index audit_reference_idx on audit_log(transaction_type, reference);

alter table employees enable row level security;
alter table sales enable row level security;
alter table expenses enable row level security;
alter table audit_log enable row level security;

-- The application uses the server-side service role. No direct anonymous writes are allowed.
