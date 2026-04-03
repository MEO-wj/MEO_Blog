# PlayStation 5 Set

## Stored Files

- Raw model: `external-assets/raw/ps5/playstation-5-set_1k.glb`
- Split outputs:
  - `external-assets/processed/glb/ps5-box.glb`
  - `external-assets/processed/glb/ps5-console.glb`
  - `external-assets/processed/glb/dualsense-controller.glb`

## Source

- Title: `PlayStation 5 Set`
- Source URL: <https://sketchfab.com/3d-models/playstation-5-set-8e602d71ddc94bf09731db9151fc7cd3>
- Author: `Taohid Animation`
- License: `CC BY 4.0`

## Download Notes

- Downloaded format: `GLB`
- Downloaded variant: `1k`
- File size: about `7.6 MB`

## Inspection Summary

The file is usable and is not a single welded mesh blob.

Parsed GLB structure:

- Scenes: `1`
- Nodes: `170`
- Meshes: `58`
- Materials: `30`
- Images: `8`

Top-level groups under the scene root:

- Group A: `Sketchfab Model_3`
  Likely the packaging box or box-related parts.
  Contains `3` mesh nodes.
- Group B: `Sketchfab Model.001_100`
  Clearly contains the `DualSense` controller hierarchy.
  Contains `48` mesh nodes.
- Group C: `Sketchfab Model.002_108`
  Likely the PS5 console body and stand-related parts.
  Contains `7` mesh nodes.

## Practical Conclusion

- `Controller`: high flexibility as a separate top-level group.
- `Console`: likely usable as a separate top-level group.
- `Box`: likely usable as a separate top-level group.
- Internal subparts are fragmented into many meshes, which is good for editing but may need cleanup before final export.

## Recommended Next Step

Open the model in Blender and verify the three top-level branches in the Outliner.

This split has now been completed at the GLB level.

Current exported assets:

- `ps5-box.glb`
- `ps5-console.glb`
- `dualsense-controller.glb`

If you later want cleaner production assets, the next improvement step is to open the original source in Blender, rename the internal objects, remove unwanted fragments, and export polished final versions for `public/models/`.
