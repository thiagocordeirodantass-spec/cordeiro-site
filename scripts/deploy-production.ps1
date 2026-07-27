$ErrorActionPreference = "Stop"

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)]
    [scriptblock]$Command,
    [Parameter(Mandatory = $true)]
    [string]$FailureMessage
  )

  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw $FailureMessage
  }
}

$maintenancePublished = $false
$releasePublished = $false

try {
  Write-Host "Ativando e publicando o aviso de manutenção antes da validação..."
  Invoke-Checked {
    npx.cmd vercel env add MAINTENANCE_MODE production --value true --yes --force
  } "Não foi possível ativar a variável de manutenção."

  Invoke-Checked {
    npx.cmd vercel --prod --yes
  } "Não foi possível publicar o aviso de manutenção."
  $maintenancePublished = $true

  Write-Host "Validando a atualização com a manutenção já visível..."
  Invoke-Checked {
    npm.cmd --prefix frontend-modern run build
  } "A compilação da atualização falhou."

  Write-Host "Publicando e liberando a atualização validada..."
  Invoke-Checked {
    npx.cmd vercel env add MAINTENANCE_MODE production --value false --yes --force
  } "Não foi possível preparar a liberação da manutenção."

  Invoke-Checked {
    npx.cmd vercel --prod --yes
  } "A publicação final falhou."
  $releasePublished = $true
}
finally {
  if ($maintenancePublished -and -not $releasePublished) {
    Write-Warning "A publicação final falhou. Executando liberação de recuperação..."
    npx.cmd vercel env add MAINTENANCE_MODE production --value false --yes --force
    npx.cmd vercel --prod --yes
    if ($LASTEXITCODE -ne 0) {
      Write-Error "A recuperação automática falhou. Verifique a produção imediatamente."
    }
  }
}

Write-Host "Atualização concluída e manutenção encerrada automaticamente."
