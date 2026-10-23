import { createImageBlockConfig, imageParse } from "@blocknote/core";
import {
  createReactBlockSpec,
  ImageToExternalHTML,
  ResizableFileBlockWrapper,
  type ReactCustomBlockRenderProps,
  useResolveUrl,
} from "@blocknote/react";
import { ImageBrokenIcon } from "@phosphor-icons/react/ImageBroken";
import { TrashIcon } from "@phosphor-icons/react/Trash";
import { useState } from "react";

import { Button } from "@/components/ui/button.tsx";
import { getImagePresentation } from "./image-presentation.ts";

const TRANSPARENT_IMAGE = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

const LazuliImageBlock = (props: ReactCustomBlockRenderProps<typeof createImageBlockConfig>) => {
  const pendingUpload = !props.block.props.url;
  const resolved = useResolveUrl(props.block.props.url || TRANSPARENT_IMAGE);
  const [failedSource, setFailedSource] = useState<string>();
  const presentation = getImagePresentation(pendingUpload, resolved, failedSource);

  return (
    <ResizableFileBlockWrapper
      {...(props as any)}
      buttonIcon={<ImageBrokenIcon aria-hidden size={24} weight="duotone" />}
    >
      {presentation.kind === "uploading" ? (
        <div className="lazuli-image-uploading" contentEditable={false}>
          Enviando imagem…
        </div>
      ) : presentation.kind === "loading" ? (
        <div
          aria-label="Carregando imagem"
          className="lazuli-image-loading"
          contentEditable={false}
          role="status"
        />
      ) : presentation.kind === "error" ? (
        <div className="lazuli-broken-image" contentEditable={false}>
          <ImageBrokenIcon aria-hidden weight="duotone" />
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
            <TrashIcon aria-hidden />
            Remover
          </Button>
        </div>
      ) : (
        <img
          alt={props.block.props.name || ""}
          className="bn-visual-media"
          contentEditable={false}
          draggable={false}
          onError={() => setFailedSource(presentation.source)}
          src={presentation.source}
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
