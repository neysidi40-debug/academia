import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getInitialState, readPersistedState, restoreExampleData, savePersistedState } from "../services/dataService";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, setState] = useState(() => ({ ...getInitialState(), carregando: true, erro: "" }));

  const carregar = useCallback(() => {
    setState((previous) => ({ ...previous, carregando: true, erro: "" }));
    try {
      const saved = readPersistedState();
      setState({ ...saved, carregando: false, erro: "" });
    } catch {
      setState((previous) => ({ ...previous, carregando: false, erro: "Não foi possível carregar seus dados salvos. Tente novamente ou restaure os dados de exemplo." }));
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (!state.carregando && !state.erro) {
      try {
        savePersistedState({ usuario: state.usuario, dados: state.dados });
      } catch {
        setState((previous) => ({ ...previous, erro: "Não foi possível salvar as alterações neste navegador." }));
      }
    }
  }, [state.usuario, state.dados, state.carregando, state.erro]);

  const atualizarDados = useCallback((categoria, atualizar) => {
    setState((previous) => {
      if (!Object.hasOwn(previous.dados, categoria)) return previous;
      const atual = previous.dados[categoria];
      const proximo = typeof atualizar === "function" ? atualizar(atual) : atualizar;
      return { ...previous, dados: { ...previous.dados, [categoria]: proximo } };
    });
  }, []);

  const entrar = useCallback((usuario) => {
    setState((previous) => ({ ...previous, usuario }));
  }, []);

  const sair = useCallback(() => {
    setState((previous) => ({ ...previous, usuario: null }));
  }, []);

  const restaurar = useCallback(() => {
    try {
      const initial = restoreExampleData();
      setState({ ...initial, carregando: false, erro: "" });
      return true;
    } catch {
      setState((previous) => ({ ...previous, erro: "Não foi possível restaurar os dados de exemplo. Tente novamente." }));
      return false;
    }
  }, []);

  const value = useMemo(() => ({
    usuario: state.usuario,
    dados: state.dados,
    carregando: state.carregando,
    erro: state.erro,
    atualizarDados,
    entrar,
    sair,
    restaurar,
    tentarCarregar: carregar,
  }), [state, atualizarDados, entrar, sair, restaurar, carregar]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp deve ser usado dentro de AppProvider.");
  return context;
}
