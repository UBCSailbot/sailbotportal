# Application Priority — Design

**Status:** implemented 2026-11-18 (proof of concept, issue #16)

Leads can mark an application **High**, **Medium** or **Low** priority, or leave it unset, from the
board card and from the applicant detail view. Priority is stored per application, so the same
person can be High for one team and Low for another. This reverses the "No ratings" decision in
[the hiring portal design](2026-08-15-hiring-portal-design.md) §3.

## Why we're adding priority

Team leads decided that they wanted a way to prioritize applicants before and post-interview. We add a priority labelling system to let them do this. 

## Data model

We add a new column to the ```applicants``` table called ```priority```. Column is next and nullable, with a constraint that checks its value is one of "high", "medium", or "low".

## Read path

```getBoardApplications``` now queries for the ```priority``` column as well, an the ```BoardCard``` type includes it as a property. We use this value when passing this data to the frontend and rendering the cards. The label's style is determined by its priority type (high, medium, low). 

## Write path

We pass ```handlePriorityChange``` as a priority change handler to the application card through ```board.tsx``` -> ```column.tsx``` -> ```card.tsx```. This fires when user changes the priority label from the frontend dropdown to one of "high", "medium", or "low". Users can also choose "None" which sets it back to null. ```handlePriorityChange``` calls ```setApplicationPriority``` which is a database action changing the actual application's ```priority``` value. 

## Optimistic updates

To ensure that the state of the change is immediately reflected by the UI, we do an optimistic update of the priority label. In the detail pane and board, we immediately change the label while waiting for the database operation to finish and the component to reload. If the database operation fails we rollback the optimistic update. 

## The picker

Added new ```PriorityPicker``` component that renders the priority label options to the user when they click on the "+" icon or existing priority label of the application. 

## Decisions

There were two main options for the priority label data change. We could add a new column that enforces an enumeration, or we could let the column have any value and enforce the enumeration at the backend level. The former is what we're doing and the latter is an alternative design that would let us add new labels without a DB migration. However, we decided to go with the DB column enforcing the enumeration with a CHECK constraint because ```status``` follows this pattern and we are unlikely to add more priority labels. In the future if we do want to add more non-priority labels, we can use GitHub's design paradigm that separates the two label types, one set for priority and one set for any other description. 
