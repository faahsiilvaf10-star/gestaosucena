!include "WinMessages.nsh"

Function myInstFilesShow
  ; Fundo preto: 0x090A0C, Texto branco: 0xFFFFFF
  SetCtlColors $HWNDPARENT 0xFFFFFF 0x090A0C
  
  ; Procura o diálogo interno
  FindWindow $0 "#32770" "" $HWNDPARENT
  SetCtlColors $0 0xFFFFFF 0x090A0C
  
  ; Altera a cor do texto "Instalando..." (geralmente item 1006)
  GetDlgItem $2 $0 1006
  SetCtlColors $2 0xFFFFFF 0x090A0C

  ; Altera a barra de progresso (item 1004)
  GetDlgItem $1 $0 1004
  SendMessage $1 ${PBM_SETBARCOLOR} 0 0x2BA7D6
  SendMessage $1 ${PBM_SETBKCOLOR} 0 0x161211
FunctionEnd
