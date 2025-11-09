import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { saveAuthToken, getAuthToken, clearAuthToken, clearAllLocalData, syncFromSupabase } from "@/lib/localDB";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [offlineUser, setOfflineUser] = useState<User | null>(null);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' && !navigator.onLine) {
          console.log('⚠️ Sesión cerrada pero offline - manteniendo sesión local');
          const storedUser = localStorage.getItem('offline_user');
          if (storedUser) {
            const user = JSON.parse(storedUser);
            setUser(user);
            setOfflineUser(user);
            return;
          }
        }

        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Guardar usuario en localStorage para sesión offline
        if (session?.user) {
          localStorage.setItem('offline_user', JSON.stringify(session.user));
          await saveAuthToken(
            session.user.id,
            session.refresh_token,
            session.access_token,
            session.expires_at
          );
        } else if (navigator.onLine) {
          localStorage.removeItem('offline_user');
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        // Sin sesión pero offline: intentar restaurar desde localStorage
        if (!navigator.onLine) {
          const storedUser = localStorage.getItem('offline_user');
          if (storedUser) {
            const user = JSON.parse(storedUser);
            setUser(user);
            setOfflineUser(user);
            console.log('✅ Sesión offline restaurada desde localStorage');
            setLoading(false);
            return;
          }
        }

        // Si supabase no encontró sesión, verificar IndexedDB
        try {
          const storedToken = await getAuthToken();
          if (storedToken) {
            console.log('🔄 Intentando restaurar sesión desde IndexedDB...');
            
            // Intentar restaurar sesión con refresh token
            const { data, error } = await supabase.auth.setSession({
              refresh_token: storedToken.refreshToken,
              access_token: storedToken.accessToken || storedToken.refreshToken
            });
            
            if (data?.session) {
              setSession(data.session);
              setUser(data.session.user);
              toast.success('Sesión restaurada');
              console.log('✅ Sesión restaurada exitosamente');
              
              // Sincronizar datos después de restaurar sesión
              syncFromSupabase().catch(console.error);
            } else if (error) {
              console.warn('⚠️ No se pudo restaurar sesión:', error.message);
              await clearAuthToken();
            }
          }
        } catch (error) {
          console.error('❌ Error al restaurar sesión:', error);
        }
        setLoading(false);
      } else {
        // Ya había sesión en Supabase
        setSession(session);
        setUser(session.user);
        setLoading(false);
        
        // Asegurar que el token esté guardado en IndexedDB
        if (session.refresh_token) {
          await saveAuthToken(
            session.user.id,
            session.refresh_token,
            session.access_token,
            session.expires_at
          );
        }
        
        // Sincronizar datos al iniciar con sesión existente
        syncFromSupabase().catch(console.error);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Listener para validar sesión cuando vuelve online
  useEffect(() => {
    const handleOnline = async () => {
      if (offlineUser) {
        console.log('🌐 Conexión restaurada - validando sesión...');
        
        const storedToken = await getAuthToken();
        if (storedToken) {
          const { data, error } = await supabase.auth.setSession({
            refresh_token: storedToken.refreshToken,
            access_token: storedToken.accessToken || storedToken.refreshToken
          });
          
          if (data?.session) {
            toast.success('Sesión validada correctamente');
            setOfflineUser(null);
          } else {
            toast.warning('Tu sesión expiró. Por favor inicia sesión nuevamente.');
          }
        }
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [offlineUser]);

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      toast.error(error.message);
      return { error };
    }

    // Guardar token en IndexedDB si la sesión se creó inmediatamente
    if (data.session?.refresh_token) {
      await saveAuthToken(
        data.session.user.id,
        data.session.refresh_token,
        data.session.access_token,
        data.session.expires_at
      );
      
      // Sincronizar datos desde Supabase
      try {
        await syncFromSupabase();
      } catch (syncError) {
        console.error('Error al sincronizar datos:', syncError);
      }
    }

    toast.success("¡Cuenta creada exitosamente!");
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
      return { error };
    }

    // Guardar token en IndexedDB
    if (data.session?.refresh_token) {
      await saveAuthToken(
        data.session.user.id,
        data.session.refresh_token,
        data.session.access_token,
        data.session.expires_at
      );
    }

    // Sincronizar datos desde Supabase
    try {
      await syncFromSupabase();
    } catch (syncError) {
      console.error('Error al sincronizar datos:', syncError);
    }

    toast.success("¡Bienvenido de nuevo!");
    return { error: null };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });

    if (error) {
      toast.error(error.message);
    }
  };

  const signOut = async () => {
    try {
      // Primero cerrar sesión en Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        toast.error(error.message);
        return;
      }

      // Luego limpiar TODOS los datos locales
      await clearAllLocalData();
      
      toast.success("Sesión cerrada");
    } catch (error: any) {
      console.error('Error al cerrar sesión:', error);
      toast.error(error.message || "Error al cerrar sesión");
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};