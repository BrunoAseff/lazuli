import { createImageBlockConfig, imageParse } from "@blocknote/core";
import {
  createReactBlockSpec,
  ImageToExternalHTML,
  ResizableFileBlockWrapper,
  type ReactCustomBlockRenderProps,
  useResolveUrl,
} from "@blocknote/react";
import { ImageOffIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button.tsx";

const TRANSPARENT_IMAGE = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

const LazuliImageBlock = (props: ReactCustomBlockRenderProps<typeof createImageBlockConfig>) => {
  const pendingUpload = !props.block.props.url;
  const resolved = useResolveUrl(props.block.props.url || TRANSPARENT_IMAGE);
  const resolutionFailed = resolved.loadingState === "error";
  const source = resolved.loadingState === "loading" ? props.block.props.url : resolved.downloadUrl;
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => setLoadFailed(false), [source]);

  return (
    <ResizableFileBlockWrapper
      {...(props as any)}
      buttonIcon={<ImageOffIcon aria-hidden size={24} />}
    >
      {pendingUpload ? (
        <div className="lazuli-image-uploading" contentEditable={false}>
          Enviando imagem…
        </div>
      ) : loadFailed || resolutionFailed ? (
        <div className="lazuli-broken-image" contentEditable={false}>
          <ImageOffIcon aria-hidden />
          <div>
            <p>Não foi possível exibir esta imagem.</p>
            <p>O arquivo pode estar indisponível ou protegido pelo site de origem.</p>
          </div>
          <Button
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => props.editor.removeBlocks([props.block.id])}
            onMouseDown={(event) => event.preventDefault()}
            size="sm"
            variant="ghost"
          >
            <Trash2Icon aria-hidden />
            Remover
          </Button>
        </div>
      ) : (
        <img
          alt={props.block.props.name || ""}
          className="bn-visual-media"
          contentEditable={false}
          draggable={false}
          onError={() => setLoadFailed(true)}
          src={source}
          width={props.block.props.previewWidth}
        />
      )}
    </ResizableFileBlockWrapper>
  );
};

export const lazuliImageBlock = createReactBlockSpec(createImageBlockConfig, (config) => ({
  meta: { fileBlockAccept: ["image/*"] },
  parse: imageParse(config),
  render: LazuliImageBlock,
  runsBefore: ["file"],
  toExternalHTML: ImageToExternalHTML,
}));
