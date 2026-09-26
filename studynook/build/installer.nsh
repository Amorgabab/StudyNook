; StudyNook custom NSIS: shortcuts with the Mochi icon (no exe-rewrite needed)
!macro customInstall
  Delete "$DESKTOP\StudyNook.lnk"
  CreateShortCut "$DESKTOP\StudyNook.lnk" "$INSTDIR\StudyNook.exe" "" "$INSTDIR\resources\icon.ico"
  Delete "$SMPROGRAMS\StudyNook.lnk"
  CreateShortCut "$SMPROGRAMS\StudyNook.lnk" "$INSTDIR\StudyNook.exe" "" "$INSTDIR\resources\icon.ico"
!macroend
!macro customUnInstall
  Delete "$DESKTOP\StudyNook.lnk"
  Delete "$SMPROGRAMS\StudyNook.lnk"
!macroend
