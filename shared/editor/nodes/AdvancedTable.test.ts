import {
  DOMParser as ProsemirrorDOMParser,
  DOMSerializer,
} from "prosemirror-model";
import { extensionManager, findNodes, schema } from "../../test/editor";
import { createEmptyTable, setCell, updateColumn } from "../lib/advancedTable";
import type { AdvancedTableData } from "../lib/advancedTable";

const serializer = extensionManager.serializer();
const parser = extensionManager.parser({
  schema,
  plugins: extensionManager.rulePlugins,
});

function sampleData(): AdvancedTableData {
  let data = createEmptyTable(2, 2);
  const [a, b] = data.columns;
  data = updateColumn(data, a.id, { name: "Name" });
  data = updateColumn(data, b.id, { name: "Qty", type: "number" });
  data = setCell(data, data.rows[0].id, a.id, "Apple `with` ```ticks```");
  data = setCell(data, data.rows[0].id, b.id, 5);
  data = setCell(data, data.rows[1].id, a.id, "<script>alert(1)</script>");
  return data;
}

function createDoc(data: AdvancedTableData) {
  return schema.nodes.doc.create(null, [
    schema.nodes.paragraph.create(null, schema.text("Before")),
    schema.nodes.advanced_table.create({ data }),
    schema.nodes.paragraph.create(null, schema.text("After")),
  ]);
}

describe("AdvancedTable node", () => {
  it("round trips through markdown", () => {
    const data = sampleData();
    const markdown = serializer.serialize(createDoc(data));

    expect(markdown).toContain("advanced-table");
    expect(markdown).toMatch(/^````advanced-table$/m);

    const parsed = parser.parse(markdown);
    const nodes = findNodes(parsed?.toJSON(), "advanced_table");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].attrs?.data).toEqual(data);
    expect(findNodes(parsed?.toJSON(), "code_block")).toHaveLength(0);
  });

  it("leaves other fenced code blocks untouched", () => {
    const parsed = parser.parse("```js\nconst a = 1;\n```");
    expect(findNodes(parsed?.toJSON(), "code_block")).toHaveLength(1);
    expect(findNodes(parsed?.toJSON(), "advanced_table")).toHaveLength(0);
  });

  it("falls back to an empty table for invalid markdown content", () => {
    const parsed = parser.parse("```advanced-table\n{not valid json\n```");
    const nodes = findNodes(parsed?.toJSON(), "advanced_table");
    expect(nodes).toHaveLength(1);
    const data = nodes[0].attrs?.data as AdvancedTableData | undefined;
    expect(data?.columns).toHaveLength(3);
    expect(data?.rows).toHaveLength(3);
  });
});

// DOM serialization requires a document, which is only present in jsdom runs.
const describeDom = typeof document === "undefined" ? describe.skip : describe;

describeDom("AdvancedTable node HTML", () => {
  it("round trips through HTML and escapes cell values", () => {
    const data = sampleData();
    const fragment = DOMSerializer.fromSchema(schema).serializeFragment(
      createDoc(data).content
    );
    const container = document.createElement("div");
    container.appendChild(fragment);

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("td")?.textContent).toBe(
      "Apple `with` ```ticks```"
    );
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);

    const parsed = ProsemirrorDOMParser.fromSchema(schema).parse(container);
    const nodes = findNodes(parsed.toJSON(), "advanced_table");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].attrs?.data).toEqual(data);
    expect(findNodes(parsed.toJSON(), "table")).toHaveLength(0);
  });

  it("omits hidden columns from the static HTML", () => {
    let data = sampleData();
    data = updateColumn(data, data.columns[1].id, { hidden: true });
    const dom = DOMSerializer.fromSchema(schema).serializeNode(
      schema.nodes.advanced_table.create({ data })
    );
    const element = dom instanceof HTMLElement ? dom : null;
    expect(element?.querySelectorAll("th")).toHaveLength(1);
  });

  it("falls back to an empty table for invalid HTML data", () => {
    const container = document.createElement("div");
    container.innerHTML = `<div data-advanced-table="" data-json="nope"><table></table></div>`;
    const parsed = ProsemirrorDOMParser.fromSchema(schema).parse(container);
    const nodes = findNodes(parsed.toJSON(), "advanced_table");
    expect(nodes).toHaveLength(1);
    const data = nodes[0].attrs?.data as AdvancedTableData | undefined;
    expect(data?.columns).toHaveLength(3);
  });
});

describe("AdvancedTable node text", () => {
  it("exposes cell contents as plain text for search", () => {
    const data = sampleData();
    const text = createDoc(data).textBetween(
      0,
      createDoc(data).content.size,
      "\n",
      (node) => node.type.spec.leafText?.(node) ?? ""
    );
    expect(text).toContain("Name\tQty");
    expect(text).toContain("Apple `with` ```ticks```\t5");
  });

  it("repairs malformed attribute data", () => {
    const node = schema.nodes.advanced_table.create({ data: { bogus: true } });
    const markdown = serializer.serialize(
      schema.nodes.doc.create(null, [node])
    );
    expect(markdown).toContain('"version":1');
  });
});
