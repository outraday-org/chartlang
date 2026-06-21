// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Saved-scripts sidebar over Task 3's browser-safe `scriptsClient` CRUD. Lists
// scripts (name + symbol + relative updatedAt), and offers New / Save / rename
// / delete. Persistence that touches editor + chart state (save, load) is
// delegated to the page via callbacks so the dirty-guard + symbol-load stay in
// one place; list refresh + rename + delete are owned here. The page bumps
// `reloadKey` after a save so the list re-fetches optimistically.

import {
  deleteScript,
  listScripts,
  renameScript,
  type ScriptMeta,
} from "@/lib/scriptsClient"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FilePlusIcon, PencilIcon, SaveIcon, Trash2Icon } from "lucide-react"
import { type ReactElement, useEffect, useState } from "react"
import { toast } from "sonner"

/**
 * Props for {@link ScriptsSidebar}. `onSave(name)` is called with the chosen
 * name on a *first* save (no `currentScriptId`); when a script is already
 * loaded, the Save button calls `onSave(currentName)` to update in place.
 */
export type ScriptsSidebarProps = Readonly<{
  currentScriptId: string | null
  currentName: string
  dirty: boolean
  /** Bumped by the page after a save to force a list re-fetch. */
  reloadKey: number
  onLoad: (id: string) => void
  onNew: () => void
  /** Persist the current buffer under `name` (page owns source + symbol). */
  onSave: (name: string) => void
}>

function relativeTime(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export function ScriptsSidebar(props: ScriptsSidebarProps): ReactElement {
  const [scripts, setScripts] = useState<ReadonlyArray<ScriptMeta>>([])
  const [nameOpen, setNameOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState("")
  const [renameTarget, setRenameTarget] = useState<ScriptMeta | null>(null)
  const [renameDraft, setRenameDraft] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<ScriptMeta | null>(null)

  const refresh = (): void => {
    void (async (): Promise<void> => {
      try {
        setScripts(await listScripts())
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to list scripts")
      }
    })()
  }

  // Initial load + every time the page signals a save landed.
  useEffect(refresh, [props.reloadKey])

  const handleSaveClick = (): void => {
    if (props.currentScriptId !== null) {
      // Already a tracked script — update in place under its current name.
      props.onSave(props.currentName)
      return
    }
    // First save — prompt for a name.
    setNameDraft(props.currentName || "Untitled script")
    setNameOpen(true)
  }

  const confirmName = (): void => {
    const name = nameDraft.trim()
    if (name === "") return
    setNameOpen(false)
    props.onSave(name)
  }

  const confirmRename = (): void => {
    const target = renameTarget
    const name = renameDraft.trim()
    if (target === null || name === "") return
    setRenameTarget(null)
    void (async (): Promise<void> => {
      try {
        const updated = await renameScript(target.id, name)
        if (updated === null) toast.error("Script no longer exists")
        refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Rename failed")
      }
    })()
  }

  const confirmDelete = (): void => {
    const target = deleteTarget
    if (target === null) return
    setDeleteTarget(null)
    void (async (): Promise<void> => {
      try {
        await deleteScript(target.id)
        refresh()
        if (target.id === props.currentScriptId) props.onNew()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed")
      }
    })()
  }

  return (
    <div className="flex h-full flex-col" data-testid="scripts-sidebar">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-border p-2">
        <span className="mr-auto text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Scripts
        </span>
        <Button onClick={props.onNew} size="icon-sm" title="New script" type="button" variant="ghost">
          <FilePlusIcon />
        </Button>
        <Button
          data-testid="save-script"
          disabled={!props.dirty && props.currentScriptId !== null}
          onClick={handleSaveClick}
          size="icon-sm"
          title="Save script"
          type="button"
          variant="ghost"
        >
          <SaveIcon />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <ul className="p-1.5">
          {scripts.length === 0 ? (
            <li className="px-2 py-6 text-center text-xs text-muted-foreground">
              No saved scripts yet.
            </li>
          ) : (
            scripts.map((script) => (
              <li
                className={`group/script flex items-center gap-1 rounded-md px-2 py-1.5 text-sm ${
                  script.id === props.currentScriptId ? "bg-muted" : "hover:bg-muted/60"
                }`}
                key={script.id}
              >
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => props.onLoad(script.id)}
                  type="button"
                >
                  <span className="block truncate text-foreground">{script.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {script.symbol ?? "no symbol"} · {relativeTime(script.updatedAt)}
                  </span>
                </button>
                <Button
                  className="opacity-0 group-hover/script:opacity-100"
                  onClick={() => {
                    setRenameTarget(script)
                    setRenameDraft(script.name)
                  }}
                  size="icon-xs"
                  title="Rename"
                  type="button"
                  variant="ghost"
                >
                  <PencilIcon />
                </Button>
                <Button
                  className="opacity-0 group-hover/script:opacity-100"
                  onClick={() => setDeleteTarget(script)}
                  size="icon-xs"
                  title="Delete"
                  type="button"
                  variant="ghost"
                >
                  <Trash2Icon />
                </Button>
              </li>
            ))
          )}
        </ul>
      </ScrollArea>

      {/* First-save name prompt */}
      <Dialog onOpenChange={setNameOpen} open={nameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Name your script</DialogTitle>
            <DialogDescription>Saved to your local SQLite store.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            data-testid="script-name-input"
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmName()
            }}
            placeholder="Script name"
            value={nameDraft}
          />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button data-testid="confirm-save" onClick={confirmName} type="button">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename prompt */}
      <Dialog onOpenChange={(open) => !open && setRenameTarget(null)} open={renameTarget !== null}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename script</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            onChange={(e) => setRenameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmRename()
            }}
            placeholder="Script name"
            value={renameDraft}
          />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={confirmRename} type="button">
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog onOpenChange={(open) => !open && setDeleteTarget(null)} open={deleteTarget !== null}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{deleteTarget?.name}”?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={confirmDelete} type="button" variant="destructive">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
