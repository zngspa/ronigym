<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Medical approval history is append-only and recorded by a database trigger on student approval/expiry changes so every editing screen shares the same audit trail; manual records never imply a document upload.
- Medical history presentation lives in a shared student-card component, with status derived from approval and expiry in the Israel time zone to keep past records unchanged.
- Current medical-expiry badges and administrator reminders share a pure date classifier and derive warnings from saved student data in Israel time; do not mutate historical records or persist time-based warning transitions.
