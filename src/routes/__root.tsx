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
import { ThemeProvider, useTheme } from "../contexts/ThemeContext";
import { ChatProvider } from "../contexts/ChatContext";
import { AppLayout } from "../components/AppLayout";
import { GlobalEquipmentAlert } from "../components/GlobalEquipmentAlert";
import { ReminderAlertNotification } from "../components/ReminderAlertNotification";
import { GlobalBackground } from "../components/GlobalBackground";
import { GlobalMeetingAlert } from "../components/GlobalMeetingAlert";
import { getGlobalAppearanceSettings } from "../lib/settings";

function RootContent() {
  const { isDark } = useTheme()
  const router = useRouter()
  const path = router.state.location.pathname
  const isAppRoute = (path.startsWith('/dashboard') || path.startsWith('/lembretes') || path.startsWith('/instacena') || path.startsWith('/almoxarifado') || path.startsWith('/equipamentos') || path.startsWith('/rh') || path.startsWith('/documentos') || path.startsWith('/meio-ambiente') || path.startsWith('/configuracoes') || path.startsWith('/relatorio-obra') || path.startsWith('/emergencia') || path.startsWith('/seguranca') || path.startsWith('/permissao-trabalho') || path.startsWith('/reunioes')) && !path.startsWith('/equipamentos/app-motorista')
  
  useEffect(() => {
    getGlobalAppearanceSettings().then(settings => {
      if (settings?.backgroundCss) {
        document.body.style.setProperty('--theme-bg-image', settings.backgroundCss);
        // Force the inline style in case CSS variable fails to override:
        document.body.style.backgroundImage = settings.backgroundCss;
        
        // Se houver "url" mas não tiver background-size configurado manualmente, adiciona cover por padrão:
        if (settings.backgroundCss.includes('url') && !settings.backgroundCss.includes('background-size')) {
           document.body.style.backgroundSize = 'cover';
           document.body.style.backgroundPosition = 'center center';
           document.body.style.backgroundAttachment = 'fixed';
           document.body.style.backgroundRepeat = 'no-repeat';
        } else {
           // Default fallback pra gradient
           document.body.style.backgroundSize = '24px 24px, 24px 24px, 100% 100%';
           document.body.style.backgroundAttachment = 'fixed';
        }
      }
    }).catch(console.error);
  }, []);
  
  return (
    <div className={`min-h-screen ${isDark ? 'dark text-white' : 'light text-black'}`}>
      <GlobalBackground />
      {isAppRoute ? (
        <AppLayout>
          <Outlet />
        </AppLayout>
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
      <Toaster position="bottom-left" theme={isDark ? "dark" : "light"} />
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
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Sucena Empreendimentos" },
      { name: "description", content: "Designing seamless digital interactions by focusing on the unique nuances which bring systems to life." },
      { property: "og:title", content: "Sucena Empreendimentos" },
      { property: "og:description", content: "A creative, fullstack, and founder portfolio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "icon", href: "/sucenaicon.ico" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Instrument+Serif:ital@1&display=swap&=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head><HeadContent /></head>
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
