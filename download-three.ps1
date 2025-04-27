# Create directories if they don't exist
New-Item -ItemType Directory -Force -Path "js\three\postprocessing"
New-Item -ItemType Directory -Force -Path "js\three\shaders"

# Download Three.js main file
Invoke-WebRequest -Uri "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.132.2/three.min.js" -OutFile "js\three\three.min.js"

# Download shader files
$shaderFiles = @(
    "CopyShader.js",
    "LuminosityHighPassShader.js"
)

foreach ($file in $shaderFiles) {
    $url = "https://cdn.jsdelivr.net/npm/three@0.132.2/examples/js/shaders/$file"
    Invoke-WebRequest -Uri $url -OutFile "js\three\shaders\$file"
}

# Download postprocessing files
$postprocessingFiles = @(
    "EffectComposer.js",
    "RenderPass.js",
    "ShaderPass.js",
    "UnrealBloomPass.js"
)

foreach ($file in $postprocessingFiles) {
    $url = "https://cdn.jsdelivr.net/npm/three@0.132.2/examples/js/postprocessing/$file"
    Invoke-WebRequest -Uri $url -OutFile "js\three\postprocessing\$file"
}

Write-Host "All files downloaded successfully!" 