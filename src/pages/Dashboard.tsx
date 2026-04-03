import { Outlet } from 'react-router-dom';
import SidebarNav from '../components/layout/SidebarNav';

export default function Dashboard() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <SidebarNav />
      <main className="flex-1 h-full min-h-0 min-w-0 relative">
        <Outlet />
      </main>
    </div>
  );
}
