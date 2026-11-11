import { SignInPage } from './auth/SignInPage';
import { signOut, useSession } from './auth/session';
import { appConfig } from './config/env';
import { Workspace } from './Workspace';

export default function App() {
  if (!appConfig.isValid) return <ConfigurationProblem problems={appConfig.problems} />;
  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const session = useSession();

  if (session.status === 'loading') {
    return (
      <p className="app-message" role="status">
        Checking your sign-in…
      </p>
    );
  }
  if (session.status === 'signed_out') return <SignInPage />;

  const { user } = session.session;
  return <Workspace key={user.id} userEmail={user.email ?? 'Signed in'} onSignOut={() => void signOut()} />;
}

/** Shown to the developer when .env.local is missing or wrong; the app refuses to run half-configured. */
function ConfigurationProblem({ problems }: { problems: string[] }) {
  return (
    <main id="main" className="app-message">
      <h1>Setup needed</h1>
      <ul>
        {problems.map((problem) => (
          <li key={problem}>{problem}</li>
        ))}
      </ul>
      <p>
        Copy <code>.env.example</code> to <code>.env.local</code>, fill in the values and restart <code>npm run dev</code>.
      </p>
    </main>
  );
}
