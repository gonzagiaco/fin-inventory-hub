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
        // Si el evento es SIGNED_OUT pero estamos offline, intentar mantener sesión offline
        if (event === 'SIGNED_OUT' && !navigator.onLine) {
          const storedUser = localStorage.getItem('offline_user');
          if (storedUser) {
            try {
              const parsedUser = JSON.parse(storedUser);
              setOfflineUser(parsedUser);
              setUser(parsedUser);
              console.log('🔒 Sesión offline mantenida');
              return;
            } catch (e) {
              console.error('Error al parsear usuario offline:', e);
            }
          }
        }

        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Guardar token y usuario cuando hay sesión exitosa
        if (session?.user && session.refresh_token) {
          await saveAuthToken(
            session.user.id,
            session.refresh_token,
            session.access_token,
            session.expires_at
          );
          // Guardar usuario en localStorage para modo offline
          localStorage.setItem('offline_user', JSON.stringify(session.user));
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
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

              // Guardar usuario en localStorage
              localStorage.setItem('offline_user', JSON.stringify(data.session.user));

              // Sincronizar datos después de restaurar sesión
              try {
                await syncFromSupabase();
              } catch (syncError) {
                console.error(syncError);
              }
            } else if (error) {
              console.warn('⚠️ No se pudo restaurar sesión:', error.message);
              await clearAuthToken();

              // Si estamos offline, intentar cargar usuario desde localStorage
              if (!navigator.onLine) {
                const storedUser = localStorage.getItem('offline_user');
                if (storedUser) {
                  const parsedUser = JSON.parse(storedUser);
                  setOfflineUser(parsedUser);
                  setUser(parsedUser);
                  console.log('🔒 Usuario offline cargado');
                }
              }
            }
          } else if (!navigator.onLine) {
            // Si estamos offline y no hay token, intentar cargar usuario desde localStorage
            const storedUser = localStorage.getItem('offline_user');
            if (storedUser) {
              const parsedUser = JSON.parse(storedUser);
              setOfflineUser(parsedUser);
              setUser(parsedUser);
              console.log('🔒 Usuario offline cargado sin token');
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

        // Asegurar que el token esté guardado en IndexedDB y localStorage
        if (session.refresh_token) {
          await saveAuthToken(
            session.user.id,
            session.refresh_token,
            session.access_token,
            session.expires_at
          );
          localStorage.setItem('offline_user', JSON.stringify(session.user));
        }

        // Sincronizar datos al iniciar con sesión existente
        try {
          await syncFromSupabase();
        } catch (syncError) {
          console.error(syncError);
        }
      }
    });

    // Listener para revalidar sesión cuando se recupera conexión
    const handleOnline = async () => {
      console.log('🟢 Conexión restaurada - revalidando sesión...');

      // Si hay usuario offline, intentar revalidar con tokens guardados
      if (offlineUser) {
        try {
          const storedToken = await getAuthToken();
          if (storedToken) {
            const { data, error } = await supabase.auth.setSession({
              refresh_token: storedToken.refreshToken,
              access_token: storedToken.accessToken || storedToken.refreshToken
            });

            if (data?.session) {
              setSession(data.session);
              setUser(data.session.user);
              setOfflineUser(null);
              localStorage.setItem('offline_user', JSON.stringify(data.session.user));
              toast.success('Sesión revalidada');
              console.log('✅ Sesión revalidada exitosamente');
            }
          }
        } catch (error) {
          console.error('❌ Error al revalidar sesión:', error);
        }
      }
    };

    window.addEventListener('online', handleOnline);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('online', handleOnline);
    };
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

      // Limpiar usuario offline de localStorage
      localStorage.removeItem('offline_user');
      setOfflineUser(null);

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