import {
  Color3,
  type IndicesArray,
  Matrix,
  Mesh,
  NullEngine,
  Scene,
  StandardMaterial,
  TransformNode,
  VertexData,
} from "babylonjs";
import { GLTF2Export, GLTFData } from "babylonjs-serializers";
import { type Color, IfcAPI } from "web-ifc";

const CONTEXT_FILE_NAME = "file.glb";

export default async function ifcToGltf(
  buffer: ArrayBuffer,
): Promise<Blob | undefined> {
  const glbModel = await ifcGltfConverter.convert(new Uint8Array(buffer));
  if (!glbModel) {
    return;
  }

  const { [CONTEXT_FILE_NAME]: blob } = glbModel.glTFFiles;
  if (!(blob instanceof Blob)) {
    return;
  }
  return blob;
}

class IfcToGltfConverter {
  static isWebIfcInitialized = false;

  static ifcApi: IfcAPI | null = null;

  static async initializeWebIfc(): Promise<void> {
    try {      
      this.ifcApi = new IfcAPI();
      this.ifcApi.SetWasmPath("./assets/");
      await this.ifcApi.Init();
      this.isWebIfcInitialized = true;
    } catch (e) {
      console.error(e);
    }
  }

  public async convert(ifcBuffer: Uint8Array): Promise<GLTFData | undefined> {
    const modelId = await this.loadIfcModelFromUint8Array(ifcBuffer);
    if (modelId === undefined) {
      return;
    }

    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;

    this.loadMeshesToScene(modelId, scene);
    await scene.whenReadyAsync(true);

    const gltf = await GLTF2Export.GLBAsync(scene, "file");
    scene.getEngine().dispose();
    IfcToGltfConverter.ifcApi?.CloseModel(modelId);
    return gltf;
  }

  private async loadIfcModelFromUint8Array(buffer: Uint8Array): Promise<number | undefined> {
    if (!IfcToGltfConverter.isWebIfcInitialized) {
      await IfcToGltfConverter.initializeWebIfc();
    }
    if (!buffer) {
      return;
    }
    try {
      const modelId: number | undefined = IfcToGltfConverter.ifcApi?.OpenModel(buffer);
      return modelId;
    } catch (e) {
      console.error(e);
      return;
    }
  }

  private loadMeshesToScene(modelId: number, scene: Scene): void {
    if (!IfcToGltfConverter.ifcApi) {
      console.error("IFC API is not initialized correctly");
      return;
    }

    // Used to store similar materials
    const materials = new Map<string, StandardMaterial>();

    const parentTransform = new TransformNode("module", scene);
    IfcToGltfConverter.ifcApi.StreamAllMeshes(modelId, flatMesh => {
      const geomsVectorSize = flatMesh.geometries.size();
      for (let i = 0; i < geomsVectorSize; i++) {
        const placedGeom = flatMesh.geometries.get(i);
        const geomId = placedGeom.geometryExpressID;
        const mesh = new Mesh(`id-${geomId}`, scene);
        const geom = IfcToGltfConverter.ifcApi?.GetGeometry(modelId, geomId);
        if (geom) {
          const vertices = IfcToGltfConverter.ifcApi?.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize());
          const indices = IfcToGltfConverter.ifcApi?.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize());
          if (vertices && indices) {
            const vertexData = this.getVertexData(vertices, indices);
            vertexData.applyToMesh(mesh, false);
          }
        }
        const transform = Matrix.FromArray(placedGeom.flatTransformation);
        transform.decomposeToTransformNode(mesh);
        mesh.parent = parentTransform;

        const colorId = this.generateColorMapId(placedGeom.color);
        let mat: StandardMaterial | undefined = materials.get(colorId);

        if (!mat) {
          mat = this.materialFromIfcColor(placedGeom.color, scene);
          materials.set(colorId, mat);
        }
        mesh.material = mat;
      }
    });
  }

  private materialFromIfcColor(color: Color, scene: Scene): StandardMaterial {
    const { x: r, y: g, z: b, w: alpha } = color;
    const currentColor = new Color3(r, g, b);
    const mat = new StandardMaterial(`${r.toFixed(2)}-${g.toFixed(2)}-${b.toFixed(2)}-${alpha.toFixed(2)}`, scene);
    mat.roughness = 0.8;
    mat.diffuseColor = currentColor.clone();
    mat.alpha = alpha;
    mat.backFaceCulling = false;
    // mat.invertNormalMapX = true;
    // mat.invertNormalMapY = true
    return mat;
  }

  private generateColorMapId(color: Color): string {
    return `${Math.floor(color.x * 256)}-${Math.floor(color.y * 256)}-${Math.floor(color.z * 256)}-${Math.floor(
      color.w * 256,
    )}`;
  }

  private getVertexData(vertices: Float32Array, indices: IndicesArray) {
    const positions = new Array(Math.floor(vertices.length / 2));
    const normals = new Array(Math.floor(vertices.length / 2));
    for (let i = 0; i < vertices.length / 6; i++) {
      positions[i * 3 + 0] = vertices[i * 6 + 0];
      positions[i * 3 + 1] = vertices[i * 6 + 1];
      positions[i * 3 + 2] = vertices[i * 6 + 2];
      normals[i * 3 + 0] = vertices[i * 6 + 3];
      normals[i * 3 + 1] = vertices[i * 6 + 4];
      normals[i * 3 + 2] = vertices[i * 6 + 5];
    }
    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.normals = normals;
    vertexData.indices = indices;

    return vertexData;
  }
}

const ifcGltfConverter = new IfcToGltfConverter();
