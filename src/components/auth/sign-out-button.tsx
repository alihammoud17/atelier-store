import { signOut } from "@/app/account/actions";
import { Button } from "@/components/ui";

export function SignOutButton({ block = false }: { block?: boolean }) {
  return (
    <form action={signOut}>
      <Button type="submit" variant="secondary" block={block}>
        Sign out
      </Button>
    </form>
  );
}
