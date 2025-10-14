"use client";

import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Repeat2 } from 'lucide-react';
import { useNavigationHistory } from '@/contexts/NavigationHistoryContext';
import { cn } from '@/lib/utils';
import { useAppContextDisplayMode } from '@/contexts/AppDisplayModeContext';

// A prop onCenterButtonClick foi removida, pois o componente lidará com a rolagem diretamente.
export function DynamicNavButtons() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobile, appDisplayMode, isDeviceLandscape } = useAppContextDisplayMode();
  const {
    lastProjectPath,
    lastProfilePath,
    profile1,
    profile2,
    currentProfileSlot,
    historyStack,
  } = useNavigationHistory();

  // Handler para o clique no botão central.
  const handleCenterButtonClick = () => {
    // Rola o elemento principal do documento para o topo com uma animação suave.
    // Isso é mais confiável do que window.scrollTo em algumas configurações de CSS.
    document.documentElement.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // Determina se a página atual é uma página de perfil
  const isProfilePage = location.pathname.startsWith('/profile/');
  const isProjectPage = location.pathname.startsWith('/project/');
  const isHomePage = location.pathname === '/';

  // --- Lógica do Botão Esquerdo ---
  let leftButton: { label: string; path: string } | null = null;

  if (isProjectPage) {
    // Página do Projeto: Sempre "Voltar para Todos os Projetos"
    leftButton = { label: 'All Projects', path: '/' };
  } else if (isProfilePage) {
    // Página de Perfil: "Voltar para o Último Projeto" se disponível, senão "Voltar para Todos os Projetos"
    if (lastProjectPath) {
      leftButton = { label: lastProjectPath.label, path: lastProjectPath.path };
    } else {
      leftButton = { label: 'All Projects', path: '/' };
    }
  } else if (isHomePage) { // NOVO: Para a página inicial
    leftButton = null; // Sem botão esquerdo na página inicial
  }

  // --- Lógica do Botão Direito ---
  // Atualiza o tipo para incluir o estado
  let rightButton: { label: string; path: string; action?: 'switchProfile'; state?: { initialActiveCategory: 'writing' | 'curating' } } | null = null;

  if (isProjectPage) {
    // Página do Projeto: "Voltar para o Último Perfil" se disponível
    if (lastProfilePath) {
      rightButton = { label: 'Profile', path: lastProfilePath.path };
      // NOVO: Adiciona estado ao link
      if (lastProfilePath.activeCategory) {
        rightButton.state = { initialActiveCategory: lastProfilePath.activeCategory };
      }
    }
  } else if (isProfilePage) {
    // Página de Perfil: "Trocar Perfil" se dois perfis distintos estiverem armazenados
    const currentProfileAddress = location.pathname.split('/')[2];
    const otherProfile = (currentProfileSlot === 1 && profile2 && profile2.address !== currentProfileAddress)
      ? profile2
      : (currentProfileSlot === 2 && profile1 && profile1.address !== currentProfileAddress)
        ? profile1
        : null;

    if (otherProfile) {
      rightButton = { label: 'Switch Profile', path: `/profile/${otherProfile.address}`, action: 'switchProfile' };
      // NOVO: Ao trocar de perfil, tenta manter a categoria atual se disponível
      const currentProfileEntry = historyStack.find(entry => entry.path === location.pathname);
      if (currentProfileEntry?.activeCategory) {
        rightButton.state = { initialActiveCategory: currentProfileEntry.activeCategory };
      }
    }
  } else if (isHomePage) { // NOVO: Para a página inicial
    if (lastProjectPath) {
      rightButton = { label: 'Project', path: lastProjectPath.path }; // Rótulo alterado para "Ir para o Projeto"
    } else {
      rightButton = null; // Sem botão direito se não houver último projeto
    }
  }

  // --- Lógica de Exibição do Nome do Slide Atual ---
  let currentSlideName = "Home";
  if (isProjectPage) {
    currentSlideName = "Project";
  } else if (isProfilePage) {
    currentSlideName = "Profile";
  }

  return (
    <div className={cn(
      "fixed left-0 right-0 z-30 w-full bg-hodl-darker",
      (isMobile && appDisplayMode === 'portrait' && !isDeviceLandscape) // Aplica estilos de retrato móvel apenas se NÃO for paisagem
        ? "bottom-[var(--mobile-bottom-bar-height)] border-t border-border-accent-green top-border-glow" // Móvel: border-t e top-border-glow
        : "top-[calc(var(--sticky-header-height)+var(--dynamic-nav-buttons-desktop-vertical-gap))] border-b border-border-accent-green bottom-border-glow h-[var(--dynamic-nav-buttons-height)]" // Desktop/Paisagem: border-b, bottom-border-glow e altura explícita
    )}>
      <div className="relative w-full max-w-3xl mx-auto flex justify-between items-center px-2 h-full">
        {leftButton ? (
          <Button 
            variant="ghost" 
            size="sm" 
            asChild 
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground h-6 px-2" 
          >
            <Link to={leftButton.path}>
              <ArrowLeft className="h-4 w-4" />
              {leftButton.label}
            </Link>
          </Button>
        ) : (
          <div className="w-24"></div>
        )}

        {/* Exibição do Nome do Slide Atual com estilo btn-profile */}
        <div className="absolute left-1/2 -translate-x-1/2 flex justify-center z-10">
          <div 
            className={cn(
              "btn-profile !h-[21.6px] !px-[5.4px] !py-[0.9px] !w-auto !min-w-[72px] !max-w-[108px]", // Tamanho padrão de desktop
              isMobile && "!h-[19.44px] !px-[4.86px] !py-[0.81px] !min-w-[64.8px] !max-w-[97.2px]" // 10% menor em dispositivos móveis
            )}
            onClick={handleCenterButtonClick} // ATUALIZADO: Usa o novo handler
          >
            <strong className={cn(
              "uppercase text-[7.2px]", // Tamanho da fonte padrão de desktop
              isMobile && "text-[6.48px]" // 10% menor em dispositivos móveis
            )}>{currentSlideName}</strong>
            <div id="container-stars">
              <div id="stars"></div>
            </div>
            <div id="glow">
              <div className="circle"></div>
              <div className="circle"></div>
            </div>
          </div>
        </div>

        {rightButton ? (
          <Button 
            variant="ghost" 
            size="sm" 
            asChild 
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground h-6 px-2" 
          >
            <Link to={rightButton.path} state={rightButton.state}>
              {rightButton.label}
              {rightButton.action === 'switchProfile' && <Repeat2 className="h-4 w-4" />}
              {rightButton.action !== 'switchProfile' && <ArrowLeft className="h-4 w-4 rotate-180" />}
            </Link>
          </Button>
        ) : (
          <div className="w-24"></div>
        )}
      </div>
    </div>
  );
}