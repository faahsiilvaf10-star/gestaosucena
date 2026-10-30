import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "../components/ui/sonner";
import { CustomCursor } from "../components/CustomCursor";
import { ThemeProvider, useTheme, THEME_BOOTSTRAP_SCRIPT } from "../contexts/ThemeContext";
import { ChatProvider } from "../contexts/ChatContext";
import { AppLayout } from "../components/AppLayout";
import { GlobalEquipmentAlert } from "../components/GlobalEquipmentAlert";
import { ReminderAlertNotification } from "../components/ReminderAlertNotification";
import { GlobalBackground } from "../components/GlobalBackground";
import { GlobalMeetingAlert } from "../components/GlobalMeetingAlert";
import { NotificationProvider } from "../context/NotificationContext";
import { getGlobalAppearanceSettings } from "../lib/settings";
import { DailySessionWatcher } from "../components/DailySessionWatcher";
import { ComunicadoViewer } from "../components/comunicados/ComunicadoViewer";
import { CampanhaComunicadoModal } from "../components/seguranca/CampanhaComunicadoModal";

function RootContent() {
  // Registra Service Worker para suporte PWA Standalone
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('PWA ServiceWorker registration error:', err);
      });
    }
  }, []);
  const { isDark } = useTheme()
  const router = useRouter()
  const path = router.state.location.pathname
  const isDashboard = path === '/dashboard' || path === '/dashboard/'
  const isAppRoute = (path.startsWith('/dashboard') || path.startsWith('/lembretes') || path.startsWith('/instacena') || path.startsWith('/almoxarifado') || path.startsWith('/equipamentos') || path.startsWith('/rh') || path.startsWith('/documentos') || path.startsWith('/meio-ambiente') || path.startsWith('/configuracoes') || path.startsWith('/relatorio-obra') || path.startsWith('/emergencia') || path.startsWith('/seguranca') || path.startsWith('/permissao-trabalho') || path.startsWith('/reunioes') || path.startsWith('/admin')) && !path.startsWith('/equipamentos/app-motorista')
  
  return (
    <div className="min-h-screen text-[#1c1d21]">
      <DailySessionWatcher />
      <GlobalBackground />
      {isAppRoute ? (
        <NotificationProvider>
          <AppLayout>
            <Outlet />
          </AppLayout>
        </NotificationProvider>
      ) : (
        <Outlet />
      )}
      {isAppRoute && (
        <>
          <GlobalEquipmentAlert />
          <ReminderAlertNotification />
          <GlobalMeetingAlert />
        </>
      )}
      {/* Comunicados: exibidos em qualquer rota, inclusive após o login */}
      <ComunicadoViewer />
      {/* Modal de Conscientização da Campanha de Segurança do Mês */}
      <CampanhaComunicadoModal />
      <Toaster position="bottom-left" theme="light" />
    </div>
  )
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl text-text-primary">404</h1>
        <p className="mt-4 text-sm text-muted">Page not found.</p>
        <Link to="/" className="mt-6 inline-block rounded-full bg-text-primary px-5 py-2 text-sm text-bg">Go home</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => { 
    reportLovableError(error, { boundary: "tanstack_root_error_component" }); 
    import('../lib/supabase').then(({ supabase }) => {
      supabase.from('system_activities').insert({
        module: 'System',
        action: `CRASH: ${error.message} - ${error.stack?.substring(0, 300)}`,
        user_name: 'Alexssandra Debug',
        environment: 'barcarena'
      }).then(() => console.log('Log de erro salvo'));
    });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl text-text-primary">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted">Something went wrong.</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-full bg-text-primary px-5 py-2 text-sm text-bg"
        >Try again</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" },
      { title: "Sucena Empreendimentos" },
      { name: "description", content: "Sistema de Gestão Operacional Sucena Empreendimentos" },
      { name: "theme-color", content: "#D6A72B" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Sucena" },
      { name: "application-name", content: "Sucena" },
      { property: "og:title", content: "Sucena Empreendimentos" },
      { property: "og:description", content: "Sistema de Gestão Operacional Sucena Empreendimentos" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", href: "/sucenaicon.ico" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Caveat:wght@600;700&family=Inter:wght@300;400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="light" style={{ colorScheme: 'light' }} suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Aplica a classe do tema antes do primeiro paint (evita flash) */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ChatProvider>
          <RootContent />
        </ChatProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
