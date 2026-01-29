interface SceneHeaderProps {
  sceneId: string;
  sceneName?: string;
}

export function SceneHeader({ sceneId, sceneName }: SceneHeaderProps) {
  return (
    <div id={`scene-${sceneId}`} className="scene-header">
      <h2 className="font-display text-2xl font-bold text-lmf-text">
        {sceneName || `Szene ${sceneId}`}
      </h2>
    </div>
  );
}
