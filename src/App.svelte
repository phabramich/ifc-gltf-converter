<script lang="ts">
  import { FileUploaderDropContainer } from "carbon-components-svelte";

  import { Loading } from "carbon-components-svelte";
  import ifcToGltf from "./ifc-to-gltf";
  import { Tools } from "babylonjs";

  // Sets up the IFC loading
  let isFileLoaded = false;
  let isLoading = false;

  const handleFiles = (files: File[]): void => {
    if (files.length > 0) {
      isLoading = true;
      handleIfcLoading(files[0]);
    }
  };

  const handleChange = (event: CustomEvent): void => {
    const files = event.detail;
    handleFiles(files);
  };

  const handleIfcLoading = async (file: File): Promise<void> => {
  const blob = await ifcToGltf(await file.arrayBuffer());
  Tools.DownloadBlob(blob, `${file.name}.glb`);
};
</script>

<div class="page-wrapper">
  {#if !isFileLoaded}
    <FileUploaderDropContainer
      labelText="Click or drag and drop to upload IFC file"
      validateFiles={(files) => {
        return files.filter((file) => file.name.endsWith(".ifc"));
      }}
      on:change={handleChange}
    >
    </FileUploaderDropContainer>
  {:else if isLoading}
    <Loading />
  {/if}
</div>

<style>
  .page-wrapper {
    margin: 2rem;
    position: relative;
    overflow-y: auto;
  }
  :global(label.bx--file-browse-btn) {
    max-width: 100%;
    color: rgb(140, 140, 140);
  }
  :global(label.bx--file-browse-btn):hover {
    outline: 0;
    text-decoration: none;
    align-items: center;
  }
  :global(div.bx--file__drop-container) {
    text-align: center;
    display: block;
    border-radius: 12px;
    transition: 300ms cubic-bezier(0.2, 0, 0.38, 0.9);
    border: 1px #8d8d8d;
    border-style: dashed;
  }
  :global(div.bx--file__drop-container):hover {
    background-color: lavender;
  }
  :global(div.bx--grid) {
    padding-left: 1rem;
    padding-right: 1rem;
  }
  :global(div.bx--col) {
    max-width: 63%;
    overflow: auto;
  }
</style>
